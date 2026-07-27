const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('./logger');

// ================================================================
// Production-safe OTP / email delivery service.
//
// Design goals (ordered by priority):
//   1. NEVER block signup because of email failure on a portfolio
//      deployment. Always log the OTP to hosting logs so the
//      admin can manually verify. Only throw when the admin
//      explicitly opts in with EMAIL_REQUIRE_DELIVERY=true.
//   2. Support multiple providers with a clean priority order so
//      teams can pick whatever delivers best for them:
//          a) Resend API         (RECOMMENDED - zero SMTP pain,
//                                 excellent deliverability, HTTP)
//          b) Generic SMTP       (SendGrid / Mailgun / Brevo /
//                                 AWS SES SMTP / Postmark etc)
//          c) Gmail SMTP         (last resort — Gmail aggressively
//                                 blocks datacenter IPs)
//   3. Always-on structured pino logs (otp field + provider status)
//      in ANY environment so Render/Heroku/CloudWatch/etc logs are
//      scannable without grepping random [DEV EMAIL] banners.
//   4. Transient-error retry (1x) for network blips / 429s / 5xx.
//   5. Expose a status + recent-attempts API so deployers can
//      diagnose "why aren't emails arriving" without sifting
//      through logs or running a full signup flow.
// ================================================================

// ----- Lazy env helpers (never lock env values at module load) -----
const getIsDev = () => process.env.NODE_ENV !== 'production';
const getRequireDelivery = () => process.env.EMAIL_REQUIRE_DELIVERY === 'true';

// ----- Ring buffer for last N delivery attempts (debug endpoint) -----
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

// ----- Human-friendly dev console banner (LOCALHOST ONLY) -----
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
    console.log(`[DEV EMAIL] OTP: ${otp}  <------- copy this`);
  }
  // eslint-disable-next-line no-console
  console.log(`[DEV EMAIL] Body:\n${options.message}`);
  // eslint-disable-next-line no-console
  console.log(`${bar}\n`);
};

const logEmailAttempt = (options, status, extras = {}) => {
  const otpHint = extractOtpHint(options.message);
  const level =
    status === 'error' ? 'error' : status === 'warn' ? 'warn' : 'info';
  logger[level](
    {
      to: options.email,
      subject: options.subject,
      otp: otpHint || undefined,
      status,
      ...extras,
    },
    'Email dispatch'
  );
};

// ----- Transient-error classifier for retry logic -----
const isTransient = (provider, err) => {
  const code =
    err?.status ||
    err?.response?.status ||
    err?.code ||
    err?.responseCode ||
    0;
  const msg = (err?.message || err?.error || '').toLowerCase();
  if (provider === 'resend') {
    // 429 rate limit, 5xx server errors, axios ECONNRESET/ETIMEDOUT
    if (code === 429 || (code >= 500 && code < 600)) return true;
    if (/timeout|econnreset|enetunreach|eai_again/.test(msg)) return true;
  }
  if (provider.startsWith('smtp')) {
    // SMTP 4xx = transient; also socket-level blips
    if (code >= 400 && code < 500) return true;
    if (/timeout|econnreset|enetunreach|dns|socket/.test(msg)) return true;
  }
  return false;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ================================================================
// PROVIDER #1: Resend HTTP API (RECOMMENDED — best deliverability)
// ================================================================
const sendViaResend = async (options) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const provider = 'resend';
  const doSend = async () => {
    const resp = await axios.post(
      'https://api.resend.com/emails',
      {
        from,
        to: [options.email],
        subject: options.subject,
        text: options.message,
        html: `<p>${options.message.replace(/\n/g, '<br/>')}</p>`,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return {
      success: true,
      provider,
      id: resp.data?.id,
      status: resp.status,
    };
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await doSend();
    } catch (err) {
      const wrappedErr = {
        message: err.response?.data?.message || err.message,
        status: err.response?.status || 0,
        code: err.code,
      };
      if (attempt === 0 && isTransient(provider, wrappedErr)) {
        logger.warn(
          { provider, error: wrappedErr, retryAfterMs: 2000 },
          'Email provider transient failure — retrying'
        );
        await sleep(2000);
        continue;
      }
      return {
        success: false,
        provider,
        error: wrappedErr.message,
        status: wrappedErr.status,
        code: wrappedErr.code,
      };
    }
  }
};

// ================================================================
// PROVIDER #2: Generic SMTP (SendGrid / Mailgun / Brevo / AWS SES)
// ================================================================
const sendViaSmtp = async (options) => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;

  const secure =
    process.env.SMTP_SECURE === 'true' || String(port) === '465';
  const from = process.env.SMTP_FROM || user;
  const provider = `smtp:${host}`;

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
      const wrappedErr = {
        message: err.message,
        code: err.code,
        responseCode: err.responseCode,
        command: err.command,
      };
      if (attempt === 0 && isTransient(provider, wrappedErr)) {
        logger.warn(
          { provider, error: wrappedErr, retryAfterMs: 2000 },
          'Email provider transient failure — retrying'
        );
        await sleep(2000);
        continue;
      }
      return {
        success: false,
        provider,
        error: wrappedErr.message,
        code: wrappedErr.code,
        responseCode: wrappedErr.responseCode,
      };
    }
  }
};

// ================================================================
// PROVIDER #3: Gmail SMTP (last resort — Google blocks datacenters)
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
      const wrappedErr = {
        message: err.message,
        code: err.code,
        responseCode: err.responseCode,
      };
      if (attempt === 0 && isTransient(provider, wrappedErr)) {
        logger.warn(
          { provider, error: wrappedErr, retryAfterMs: 2000 },
          'Email provider transient failure — retrying'
        );
        await sleep(2000);
        continue;
      }
      return {
        success: false,
        provider,
        error: wrappedErr.message,
        code: wrappedErr.code,
        responseCode: wrappedErr.responseCode,
      };
    }
  }
};

// ================================================================
// Provider status (for /health/email debug endpoint)
// ================================================================
const getEmailProviderStatus = () => ({
  environment: process.env.NODE_ENV,
  requireDelivery: getRequireDelivery(),
  providers: {
    resend: {
      configured: Boolean(process.env.RESEND_API_KEY),
      from: process.env.RESEND_FROM || 'onboarding@resend.dev',
    },
    smtp: {
      configured: Boolean(
        process.env.SMTP_HOST &&
          process.env.SMTP_PORT &&
          process.env.SMTP_USER &&
          process.env.SMTP_PASS
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
  priority: ['resend', 'smtp', 'gmail'],
  otpPolicy:
    getRequireDelivery()
      ? 'strict (signup fails if email cannot be delivered)'
      : 'relaxed (OTP logged to hosting logs for manual verification)',
});

// ================================================================
// Main send entry point
// ================================================================
const sendEmail = async (options) => {
  const otpHint = extractOtpHint(options.message);

  logEmailAttempt(options, 'info', {
    provider: 'attempt',
    otpSentToDevBanner: getIsDev(),
  });
  devConsoleBanner(options, otpHint);

  const providers = [
    { name: 'resend', fn: sendViaResend },
    { name: 'smtp', fn: sendViaSmtp },
    { name: 'gmail', fn: sendViaGmail },
  ];

  const attempts = [];
  let win = null;

  for (const { name, fn } of providers) {
    const r = await fn(options);
    if (r === null) continue; // not configured
    attempts.push(r);
    if (r.success) {
      win = r;
      break;
    }
    logger.warn(
      { provider: name, error: r.error, code: r.code || r.status || null },
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
      otp: otpHint || undefined,
    });
    return { success: true, message: 'Email delivered', attempts, deliveredBy: win.provider };
  }

  if (!anyProviderConfigured) {
    logEmailAttempt(options, 'warn', {
      delivered: false,
      reason:
        'No email provider configured (set RESEND_API_KEY or SMTP_HOST+PORT+USER+PASS or EMAIL_USER+EMAIL_PASS to actually send). OTP was logged to hosting logs for manual verification.',
    });
    pushRecent({
      to: options.email,
      subject: options.subject,
      status: 'skipped (no provider configured)',
      otp: otpHint || undefined,
    });
    if (getRequireDelivery()) {
      throw new Error(
        'Failed to send email: no provider configured and EMAIL_REQUIRE_DELIVERY=true'
      );
    }
    return {
      success: true,
      skipped: true,
      message:
        'No email provider configured. OTP has been logged to server logs — look for "Email dispatch" with otp=... field.',
      otp: otpHint || undefined,
      attempts,
    };
  }

  // Providers configured but all failed
  logEmailAttempt(options, 'error', { delivered: false, attempts });
  pushRecent({
    to: options.email,
    subject: options.subject,
    status: 'failed',
    providersTried: attempts.map((a) => a.provider),
    errors: attempts.map((a) => ({ provider: a.provider, error: a.error, code: a.code || a.status || null })),
    otp: otpHint || undefined,
  });
  if (getRequireDelivery()) {
    const lastErr = attempts.filter((a) => !a.success).pop();
    throw new Error(
      `Failed to send email: ${lastErr?.error || 'unknown provider error'}`
    );
  }
  return {
    success: true,
    skipped: true,
    message: `Email providers failed (${attempts
      .map((a) => `${a.provider}:${a.error || 'err'}`)
      .join(', ')}). OTP logged to hosting logs for manual verification.`,
    otp: otpHint || undefined,
    attempts,
  };
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendTestEmail = async (toEmail) =>
  sendEmail({
    email: toEmail,
    subject: 'Test email from SmartReach AI',
    message:
      'If you received this, your email provider is configured correctly.\n\nThis was sent by the /health/email/test debug endpoint.',
  });
module.exports.getEmailProviderStatus = getEmailProviderStatus;
module.exports.getRecentAttempts = getRecentAttempts;
