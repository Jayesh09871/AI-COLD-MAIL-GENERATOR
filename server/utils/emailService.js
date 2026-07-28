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
//   - Gmail SMTP is COMMENTED OUT below for now. If needed later,
//     uncomment the sendViaGmail block and re-add it to the
//     providers array in sendEmail().
//
// Error-handling policy:
//   - If Brevo SMTP credentials are configured (SMTP_HOST/PORT/USER/PASS
//     are all set), sendEmail RETURNS AN ERROR (throws or returns
//     { success: false, error: '...' }) if the email can't be
//     delivered, so register/resend-otp do NOT falsely report success.
//   - Only if NO provider is configured at all (SMTP vars missing)
//     do we return { success: true, skipped: true }
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
// Email rendering helpers — richer HTML body + standard headers
// dramatically improve Gmail Primary-tab placement.
// ================================================================

// Standard transactional-email headers Gmail & Brevo respect to
// avoid the "Promotions" / "Spam" bucket.
const buildTransactionalHeaders = (from, to) => {
  const fromEmailMatch = String(from || '').match(/<([^>]+)>/);
  const fromEmail = fromEmailMatch
    ? fromEmailMatch[1]
    : String(from || '').trim();
  const listUnsubscribeMailto = fromEmail
    ? `mailto:${fromEmail}?subject=Unsubscribe%20from%20SmartReach%20AI`
    : '';
  return {
    'Precedence': 'bulk',
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'All',
    'X-MC-Autotext': 'on',
    ...(listUnsubscribeMailto
      ? { 'List-Unsubscribe': `<${listUnsubscribeMailto}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      : {}),
    // Brevo-specific tags for categorization in their dashboard
    'X-Mailer': 'Nodemailer (SmartReach AI)',
    'X-SmartReach-Type': /OTP|verification|reset|password/i.test(to)
      ? 'transactional'
      : 'transactional',
  };
};

// Plain text to HTML — preserve line breaks, escape for safety.
const escapeHtml = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const textToHtmlInline = (text) =>
  escapeHtml(text).replace(/\n/g, '<br/>');

// Extract a 6-digit OTP from text so we can highlight it in the template.
const extract6DigitCode = (text) => {
  const m = String(text || '').match(/\b(\d{6})\b/);
  return m ? m[1] : '';
};

// Fully-themed HTML template — Gmail prefers "real" HTML (not just
// a <p> wrapper) with clear branding, a proper hero section, and a
// visible footer. This is NOT marketing — it's the minimum viable
// layout so Gmail doesn't classify it as "promotional / thin content".
const buildHtmlBody = ({ subject, message }) => {
  const code = extract6DigitCode(message);
  const hasCode = Boolean(code);
  const safeSubject = escapeHtml(subject || 'SmartReach AI');
  const bodyHtml = textToHtmlInline(message);
  const year = new Date().getFullYear();

  const otpBlock = hasCode
    ? `
  <tr>
    <td style="padding: 24px 0 8px 0; text-align:center;">
      <div style="display:inline-block; background:#EEF2FF; border:2px dashed #6366F1; border-radius:14px; padding:18px 34px; letter-spacing:8px; font-size:32px; font-weight:800; color:#4338CA; font-family:'Helvetica Neue', Arial, sans-serif;">
        ${escapeHtml(code)}
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding: 4px 0 20px 0; text-align:center; font-size:13px; color:#6B7280; font-family:'Helvetica Neue', Arial, sans-serif;">
      Code valid for 10 minutes. Do not share it with anyone.
    </td>
  </tr>`
    : '';

  // If no OTP is present, show the raw body paragraphs as-is (for test emails etc.)
  const bodyBlock = hasCode
    ? ''
    : `
  <tr>
    <td style="padding: 18px 0 24px 0; font-size:15px; line-height:1.6; color:#1F2937; font-family:'Helvetica Neue', Arial, sans-serif;">
      ${bodyHtml}
    </td>
  </tr>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSubject}</title>
</head>
<body style="margin:0; padding:0; background:#F3F4F6; -webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;">
    <tr>
      <td align="center" style="padding: 32px 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#FFFFFF; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <!-- Header bar -->
          <tr>
            <td style="padding: 22px 32px; background: linear-gradient(135deg,#4F46E5 0%,#6366F1 100%); border-radius:16px 16px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#FFFFFF; font-family:'Helvetica Neue', Arial, sans-serif; font-size:18px; font-weight:700;">
                    SmartReach AI
                  </td>
                  <td align="right" style="color:#E0E7FF; font-family:'Helvetica Neue', Arial, sans-serif; font-size:12px;">
                    Transactional Email
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px 32px 12px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 6px; color:#111827; font-family:'Helvetica Neue', Arial, sans-serif; font-size:20px; font-weight:700;">
                    ${safeSubject}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0 8px 0; color:#6B7280; font-family:'Helvetica Neue', Arial, sans-serif; font-size:13px;">
                    ${new Date().toLocaleString()}
                  </td>
                </tr>
                ${bodyBlock}
                ${otpBlock}
                ${hasCode ? `
                <tr>
                  <td style="padding: 4px 0 12px 0; font-size:15px; line-height:1.6; color:#374151; font-family:'Helvetica Neue', Arial, sans-serif;">
                    Enter this 6-digit code on the SmartReach AI verification screen to confirm your identity. If you did not request this email, you can safely ignore it.
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px 26px 32px; border-top:1px solid #E5E7EB; background:#FAFAFA; border-radius:0 0 16px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#6B7280; font-family:'Helvetica Neue', Arial, sans-serif; font-size:12px; line-height:1.6;">
                    &copy; ${year} SmartReach AI. This email was sent in response to an account action (registration, verification, or password reset) initiated by you.
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px; color:#9CA3AF; font-family:'Helvetica Neue', Arial, sans-serif; font-size:11px;">
                    SmartReach AI &middot; AI-powered cold email generator
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

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
  // Use the from-address domain as reply-to so replies don't bounce to Brevo's envelope
  const replyTo = process.env.SMTP_REPLY_TO || from;
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
    const subject = options.subject || 'SmartReach AI';
    const textBody = options.message || '';
    const headers = buildTransactionalHeaders(from, subject);
    const htmlBody = options.html || buildHtmlBody({ subject, message: textBody });

    const mail = {
      from,
      to: options.email,
      replyTo,
      subject,
      text: textBody,
      html: htmlBody,
      headers,
    };
    const info = await getTransporter().sendMail(mail);
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
//
// ** COMMENTED OUT TEMPORARILY — using Brevo only for localhost as well. **
// To re-enable Gmail fallback:
//   1. Uncomment the sendViaGmail function below
//   2. Uncomment the gmail entry inside getEmailProviderStatus.providers
//   3. Re-add { name: 'gmail-smtp', fn: sendViaGmail } to the providers
//      array inside the sendEmail() function.
// ================================================================
/*
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
*/

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
      replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || process.env.SMTP_USER || null,
    },
    // Gmail SMTP is commented out for now (see sendViaGmail block above)
    /*
    gmail: {
      configured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      user: process.env.EMAIL_USER || null,
    },
    */
  },
  priority: ['brevo-smtp (primary & only — gmail commented out)'],
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

  // Gmail SMTP provider is commented out for now (using Brevo only).
  // To re-enable Gmail fallback: uncomment the sendViaGmail function
  // above and add it back to the providers array here.
  const providers = [
    { name: 'brevo-smtp', fn: sendViaBrevoSmtp },
    // { name: 'gmail-smtp', fn: sendViaGmail },
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
