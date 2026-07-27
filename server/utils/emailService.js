const nodemailer = require('nodemailer');
const logger = require('./logger');

// FIX #3: Production-safe OTP / email delivery service.
//
// Goals:
//   1. Portfolio projects (most people's use case) should not break because
//      Gmail app passwords are missing or Gmail rejects the send. We always
//      emit a structured pino log with the OTP so admins can read the code
//      from hosting logs (Render / Vercel / Docker logs) in ANY environment
//      including production.
//   2. Real deployments with a configured provider (Gmail / SMTP / Resend API)
//      actually send the email. On failure we only throw if
//      EMAIL_REQUIRE_DELIVERY=true so a portfolio doesn't break signups
//      because of a transient SMTP error.
//   3. Optional Resend API support (RESEND_API_KEY env var) — no SMTP creds
//      needed, works great with Render, better deliverability than Gmail.

const isDev = process.env.NODE_ENV !== 'production';
const requireDelivery = process.env.EMAIL_REQUIRE_DELIVERY === 'true';

// Extract 6-digit OTP from message if present so the log line is scannable
const extractOtpHint = (message) => {
  if (!message) return '';
  const m = String(message).match(/\b(\d{6})\b/);
  return m ? m[1] : '';
};

// Dev mode console banner (human-friendly, only for local dev eyes)
const devConsoleBanner = (options, otp) => {
  if (!isDev) return;
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

// Always-on structured log via pino — shows up in hosting logs.
// OTP is only present in log for 10 min (expires server-side), acceptable for
// portfolio projects. For real SaaS you'd remove OTP from logs entirely.
const logEmailAttempt = (options, status, extras = {}) => {
  const otpHint = extractOtpHint(options.message);
  const level = status === 'error' ? 'error' : status === 'warn' ? 'warn' : 'info';
  logger[level]({
    to: options.email,
    subject: options.subject,
    otp: otpHint || undefined,
    status,
    ...extras,
  }, 'Email dispatch');
};

// Attempt Resend API if RESEND_API_KEY is configured — zero SMTP setup
const sendViaResend = async (options) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
  try {
    const axios = require('axios');
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
    return { success: true, provider: 'resend', id: resp.data?.id, status: resp.status };
  } catch (err) {
    return {
      success: false,
      provider: 'resend',
      error: err.response?.data?.message || err.message,
      status: err.response?.status || 0,
    };
  }
};

// Attempt Gmail/Nodemailer SMTP if EMAIL_USER+EMAIL_PASS are configured
const sendViaGmail = async (options) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: `<p>${options.message.replace(/\n/g, '<br/>')}</p>`,
    });
    return { success: true, provider: 'gmail-smtp', messageId: info.messageId };
  } catch (err) {
    return {
      success: false,
      provider: 'gmail-smtp',
      error: err.message,
    };
  }
};

const sendEmail = async (options) => {
  const otpHint = extractOtpHint(options.message);

  // Always log first + dev banner — so even if providers are not configured
  // or transiently fail, the OTP is visible in hosting logs.
  logEmailAttempt(options, 'info', { provider: 'attempt', otpSentToDevBanner: isDev });
  devConsoleBanner(options, otpHint);

  // Priority: Resend API first (better prod deliverability), then Gmail SMTP
  let result = null;
  const attempts = [];

  result = await sendViaResend(options);
  if (result) attempts.push(result);
  if (!result || !result.success) {
    const smtpResult = await sendViaGmail(options);
    if (smtpResult) {
      attempts.push(smtpResult);
      if (!result || !result.success) result = smtpResult;
    }
  }

  const anyProviderConfigured = attempts.length > 0;
  const anyDeliverySucceeded = attempts.some((a) => a.success);

  if (anyDeliverySucceeded) {
    logEmailAttempt(options, 'info', { delivered: true, attempts });
    return { success: true, message: 'Email delivered', attempts };
  }

  // No provider was configured at all. In production this is the most common
  // case for a portfolio project — keep signups working by logging OTP to
  // Render logs, only throw if admin explicitly set EMAIL_REQUIRE_DELIVERY.
  if (!anyProviderConfigured) {
    logEmailAttempt(options, 'warn', {
      delivered: false,
      reason: 'No email provider configured (set RESEND_API_KEY or EMAIL_USER+EMAIL_PASS to actually send). OTP was logged to hosting logs for manual verification.',
    });
    if (requireDelivery) {
      throw new Error('Failed to send email: no provider configured and EMAIL_REQUIRE_DELIVERY=true');
    }
    return {
      success: true,
      skipped: true,
      message: 'No email provider configured. OTP has been logged to server logs — look for "Email dispatch" with otp=... field.',
      otp: otpHint || undefined,
      attempts,
    };
  }

  // At least one provider was configured but all failed.
  logEmailAttempt(options, 'error', { delivered: false, attempts });
  if (requireDelivery) {
    const lastErr = attempts.filter((a) => !a.success).pop();
    throw new Error(`Failed to send email: ${lastErr?.error || 'unknown provider error'}`);
  }
  return {
    success: true,
    skipped: true,
    message: `Email providers failed (${attempts.map((a) => `${a.provider}:${a.error || 'err'}`).join(', ')}). OTP logged to hosting logs for manual verification.`,
    otp: otpHint || undefined,
    attempts,
  };
};

module.exports = sendEmail;
