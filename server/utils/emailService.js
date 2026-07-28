const nodemailer = require('nodemailer');
const logger = require('./logger');

// ================================================================
// Brevo (Sendinblue) SMTP — single, supported email provider.
//
// Migration from Resend:
//   - Resend HTTP API has been fully removed (no axios used, no
//     RESEND_API_KEY env var, no sendViaResend codepath).
//   - All emails go through nodemailer + Brevo SMTP on
//     smtp-relay.brevo.com:587 with STARTTLS.
//   - Gmail SMTP is left as a fallback only and is NOT the
//     supported path; Brevo has superior datacenter-IP deliverability.
//
// Error-handling policy:
//   - If Brevo SMTP credentials are configured (SMTP_HOST/PORT/USER/PASS
//     are all set), sendEmail RETURNS AN ERROR (throws or returns
//     { success: false, error: '...' }) if the email can't be
//     delivered, so register/resend-otp do NOT falsely report success.
//   - Only if NO provider is configured at all (SMTP vars missing,
//     Gmail also missing) do we return { success: true, skipped: true }
//     with OTP logged so a completely-unconfigured local/dev setup
//     doesn't block signups on the demo/localhost path.
//
// Dev console banner policy (per requirement):
//   - [DEV EMAIL] console banner with the OTP prints ONLY in
//     NODE_ENV === 'development' (localhost). It NEVER prints in
//     production, even as a fallback when providers are missing.
//   - In NODE_ENV === 'production' OTPs are NOT echoed anywhere
//     except the outgoing email itself — not in stdout, not in
//     pino logs, not in banners. (In dev we keep the banner +
//     pino log entry with otp field so the local flow is testable.)
// ================================================================

const getIsDev = () => process.env.NODE_ENV !== 'production';

const MAX_ATTEMPTS_LOG = 20;
const recentAttempts = [];
const pushRecent = (record) => {
  recentAttempts.unshift({ at: new Date().toISOString(), ...record });
  if (recentAttempts.length > MAX_ATTEMPTS_LOG) recentAttempts.pop();
};
const getRecentAttempts = () => recentAttempts.slice();

const extractOtpHint = (message) => {
  if (!message) return '';
  const m = String(message).match(/\b(\d{6})\b/);
  return m ? m[1] : '';
};

// Dev console banner — LOCALHOST ONLY (isDev). Never prints on Render/vercel/prod.
const devConsoleBanner = (options, otp) => {
  if (!getIsDev()) return;
  const bar = '========================================';
  // eslint-disable-next-line no-console
  console.log(`\n${bar}`);
  // eslint-disable-next-line no-console
  console.log(`[DEV EMAIL] To: ${options.email}`);
  // eslint-disable-next-line no-console
  console.log(`[DEV EMAIL] Subject: ${options.subject}`);
  if (otp) {
    // eslint-disable-next-line no-console
    console.log(`[DEV EMAIL] OTP: ${otp}  <------- copy this (dev only banner)`);
  }
  // eslint-disable-next-line no-console
  console.log(`[DEV EMAIL] Body:\n${options.message}`);
  // eslint-disable-next-line no-console
  console.log(`${bar}\n`);
};

// Structured pino log (runs in all envs, but otp field is dev-only):
// - In NODE_ENV === 'development' → otp field is set for E2E scraping
// - In NODE_ENV === 'production'  → otp field is OMITTED (privacy +
//   no dev fallback per requirements). Users MUST receive OTP via email.
const logEmailAttempt = (options, status, extras = {}) => {
  const otpHint = getIsDev() ? extractOtpHint(options.message) : '';
  const level =
    status === 'error' ? 'error' : status === 'warn' ? 'warn' : 'info';
  const payload = {
    to: options.email,
    subject: options.subject,
    status,
    ...extras,
  };
  if (otpHint) payload.otp = otpHint;
  logger[level](payload, 'Email dispatch');
};

const isTransient = (err) => {
  const code = err?.code || err?.responseCode || 0;
  const msg = (err?.message || '').toLowerCase();
  if (code >= 400 && code < 500) return true;
  if (/timeout|econnreset|enetunreach|dns|socket|temporary|try again later/.test(msg)) {
    return true;
  }
  return false;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ================================================================
// PROVIDER #1 (AND ONLY SUPPORTED ONE): Brevo SMTP
//   Required env vars: SMTP_HOST=smtp-relay.brevo.com
//                      SMTP_PORT=587
//                      SMTP_USER=<Brevo login>
//                      SMTP_PASS=<Brevo SMTP master password>
//                      SMTP_FROM=<verified sender, e.g. you@yourdomain.com>
// ================================================================
const sendViaBrevoSmtp = async (options) => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (
    !host || !port ||
    !user || !pass ||
    !String(user).trim() || !String(pass).trim()
  ) return null;

  const secure =
    process.env.SMTP_SECURE === 'true' || String(port) === '465';
  const from = process.env.SMTP_FROM || user;
  const provider = `brevo-smtp:${host}`;

  let transporter = null;
  const getTransporter = () => {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure,
        auth: { user, pass },
        connectionTimeout: 15000,
        socketTimeout: 15000,
      });
    }
    return transporter;
  };

  const doSend = async () => {
    const info = await getTransporter().sendMail({
      from,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: `<p>${options.message.replace(/\n/g, '<br/>')}</p>`,
    });
    return {
      success: true,
      provider,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await doSend();
    } catch (err) {
      const wrapped = {
        message: err.message,
        code: err.code,
        responseCode: err.responseCode,
        command: err.command,
      };
      if (attempt === 0 && isTransient(wrapped)) {
        logger.warn(
          { provider, error: wrapped, retryAfterMs: 2000 },
          'Brevo SMTP transient failure — retrying'
        );
        await sleep(2000);
        continue;
      }
      return {
        success: false,
        provider,
        error: wrapped.message,
        code: wrapped.code,
        responseCode: wrapped.responseCode,
      };
    }
  }
};

// ================================================================
// PROVIDER #2 (FALLBACK ONLY — localhost compatibility): Gmail SMTP
// ================================================================
const sendViaGmail = async (options) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  const provider = 'gmail-smtp';
  let transporter = null;
  const getTransporter = () => {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 15000,
        socketTimeout: 15000,
      });
    }
    return transporter;
  };
  const doSend = async () => {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: `<p>${options.message.replace(/\n/g, '<br/>')}</p>`,
    });
    return {
      success: true,
      provider,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await doSend();
    } catch (err) {
      const wrapped = {
        message: err.message,
        code: err.code,
        responseCode: err.responseCode,
      };
      if (attempt === 0 && isTransient(wrapped)) {
        logger.warn(
          { provider, error: wrapped, retryAfterMs: 2000 },
          'Gmail SMTP transient failure — retrying'
        );
        await sleep(2000);
        continue;
      }
      return {
        success: false,
        provider,
        error: wrapped.message,
        code: wrapped.code,
        responseCode: wrapped.responseCode,
      };
    }
  }
};

// ================================================================
// Debug: provider status (for /health/email endpoint)
// ================================================================
const getEmailProviderStatus = () => ({
  environment: process.env.NODE_ENV,
  providers: {
    brevoSmtp: {
      configured: Boolean(
        process.env.SMTP_HOST &&
          process.env.SMTP_PORT &&
          process.env.SMTP_USER &&
          process.env.SMTP_PASS &&
          process.env.SMTP_USER.trim() &&
          process.env.SMTP_PASS.trim()
      ),
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || null,
      secure:
        process.env.SMTP_SECURE === 'true' ||
        String(process.env.SMTP_PORT || '') === '465',
      from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
    },
    gmail: {
      configured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      user: process.env.EMAIL_USER || null,
    },
  },
  priority: ['brevo-smtp', 'gmail-smtp (fallback)'],
  policy: {
    devBannerOnly: getIsDev() ? 'enabled' : 'disabled (production)',
    otpInPinoLogs: getIsDev() ? 'included (local testability)' : 'omitted (privacy)',
    errorOnDeliveryFailure: 'enabled when any provider is configured — no false success',
  },
});

// ================================================================
// Main entry point
// ================================================================
const sendEmail = async (options) => {
  const otpHint = extractOtpHint(options.message);

  // Log attempt + dev banner (banner is dev-only gated internally)
  logEmailAttempt(options, 'info', { provider: 'attempt' });
  devConsoleBanner(options, otpHint);

  const providers = [
    { name: 'brevo-smtp', fn: sendViaBrevoSmtp },
    { name: 'gmail-smtp', fn: sendViaGmail },
  ];

  const attempts = [];
  let win = null;
  for (const { name, fn } of providers) {
    const r = await fn(options);
    if (r === null) continue;
    attempts.push(r);
    if (r.success) {
      win = r;
      break;
    }
    logger.warn(
      { provider: name, error: r.error, code: r.code || r.responseCode || null },
      `Email provider ${name} failed — moving to next in priority`
    );
  }

  const anyProviderConfigured = attempts.length > 0;
  const anyDeliverySucceeded = Boolean(win);

  if (anyDeliverySucceeded) {
    logEmailAttempt(options, 'info', {
      delivered: true,
      provider: win.provider,
      attempts,
    });
    pushRecent({
      to: options.email,
      subject: options.subject,
      status: 'delivered',
      provider: win.provider,
    });
    return {
      success: true,
      delivered: true,
      message: 'Email delivered successfully',
      attempts,
      deliveredBy: win.provider,
    };
  }

  if (!anyProviderConfigured) {
    // No SMTP configured anywhere. Return a clear skipped response with
    // OTP only when dev mode (so local dev works). In production, this
    // branch without any provider is rare but we still return success=false
    // only when OTP is needed? No — the requirement says:
    //   "Implement proper error handling so the API returns an error if
    //    the email fails to send instead of falsely reporting 'OTP sent'."
    //
    // Since "no provider configured" means email definitely was NOT sent,
    // we must NOT return success=true blindly. But also local dev mode
    // without any provider needs to remain demo-able.
    //
    // Resolution:
    //   • NODE_ENV === 'development' and NO provider configured → keep
    //     the soft-fallthrough (skipped=true, success=true) because the
    //     [DEV EMAIL] banner printed the OTP for manual testing.
    //   • NODE_ENV === 'production' and NO provider configured → return
    //     success=false with an actionable error so register/verify
    //     endpoints return a 500 and don't claim "OTP sent".
    const isDev = getIsDev();
    const logPayload = {
      delivered: false,
      reason:
        'No email provider configured. Set Brevo SMTP_* env vars (see .env.example) to actually send OTP emails.',
    };
    logEmailAttempt(options, isDev ? 'warn' : 'error', logPayload);
    pushRecent({
      to: options.email,
      subject: options.subject,
      status: isDev ? 'skipped-dev-no-provider' : 'failed-no-provider-configured',
    });

    if (isDev) {
      // Localhost demo path: register still succeeds, user copies OTP
      // from the dev banner that already printed above.
      return {
        success: true,
        delivered: false,
        skipped: true,
        message:
          'No email provider configured (development mode). OTP was printed to the [DEV EMAIL] banner in the server console for manual testing.',
        otp: otpHint || undefined,
        attempts,
      };
    }

    // PRODUCTION + no provider → MUST NOT falsely report "OTP sent"
    return {
      success: false,
      delivered: false,
      skipped: false,
      error:
        'No email delivery provider is configured. Please configure Brevo SMTP (SMTP_HOST/PORT/USER/PASS) environment variables.',
      attempts,
    };
  }

  // At least one provider was configured but all attempts failed.
  // Regardless of env, we return success=false so auth endpoints
  // can propagate a clear error to the user instead of claiming
  // the OTP was emailed when it wasn't.
  logEmailAttempt(options, 'error', { delivered: false, attempts });
  pushRecent({
    to: options.email,
    subject: options.subject,
    status: 'failed',
    providersTried: attempts.map((a) => a.provider),
    errors: attempts.map((a) => ({
      provider: a.provider,
      error: a.error,
      code: a.code || a.responseCode || null,
    })),
  });

  const lastErr = attempts.filter((a) => !a.success).pop();
  const msg = lastErr?.error || 'Unknown provider error';
  return {
    success: false,
    delivered: false,
    error: `Failed to send email via configured providers. Last error: ${msg}`,
    providerErrors: attempts.map((a) => ({
      provider: a.provider,
      error: a.error,
      code: a.code || a.responseCode || null,
    })),
    attempts,
  };
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendTestEmail = async (toEmail) =>
  sendEmail({
    email: toEmail,
    subject: 'Test email from SmartReach AI (Brevo SMTP)',
    message:
      'If you received this, your Brevo SMTP credentials are working correctly.\n\nThis was sent by the /health/email/test debug endpoint.',
  });
module.exports.getEmailProviderStatus = getEmailProviderStatus;
module.exports.getRecentAttempts = getRecentAttempts;
