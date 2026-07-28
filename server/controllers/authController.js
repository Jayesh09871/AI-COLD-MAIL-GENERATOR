const { validationResult, matchedData } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/emailService');
const logger = require('../utils/logger');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendValidationResult = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.info({ errors: errors.array(), path: req.originalUrl }, 'Validation failed');
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return null;
};

exports.registerUser = async (req, res) => {
  const errorRes = sendValidationResult(req, res);
  if (errorRes) return errorRes;

  try {
    const { name, email, password } = matchedData(req);
    const normalizedEmail = email.toLowerCase();

    let existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      // If the existing account is already VERIFIED → return the usual
      // "Email already registered" 400 error. A verified user must log in
      // normally or use the password-reset flow.
      if (existingUser.isVerified) {
        logger.info({ email: normalizedEmail }, 'Registration attempt with existing VERIFIED email');
        return res
          .status(400)
          .json({ message: 'Email already registered. Please try logging in.' });
      }

      // Existing account is UNVERIFIED (the user abandoned the OTP screen or
      // never received the email). To avoid blocking the user with a stale
      // unverified row, DELETE the old document so the user can re-sign up
      // cleanly with the same email — new password, new name, new OTP.
      // This also means any EmailHistory documents owned by this stale user
      // are orphaned (acceptable since the user never verified & used them).
      logger.info(
        { email: normalizedEmail, staleUserId: existingUser._id },
        'Replacing stale unverified user record with fresh registration'
      );
      await User.deleteOne({ _id: existingUser._id, isVerified: false });
    }

    const otp = generateOTP();
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });
    await user.setOtp(otp);
    await user.save();

    const message = `Your OTP for verification is: ${otp}\n\nThis OTP is valid for 10 minutes.`;

    // FIX #4: AWAIT sendEmail() and return 500 if email fails to deliver
    // when any provider is configured — no background fire-and-forget,
    // no false "OTP sent" confirmation.
    const emailRes = await sendEmail({
      email: user.email,
      subject: 'Email Verification OTP - SmartReach AI',
      message,
    });
    if (!emailRes.success) {
      logger.warn(
        { userId: user._id, email: user.email, emailRes },
        'Registration OTP email failed to deliver — returning 500 to client'
      );
      // NOTE: We DO NOT delete the user here. The OTP hash is already stored
      // and the client can retry via /resend-otp (which also propagates errors).
      return res.status(500).json({
        message: 'Failed to send OTP email. Please retry in 30 seconds.',
        emailError: emailRes.error,
        userId: user._id,
        email: user.email,
      });
    }

    logger.info(
      { userId: user._id, email: user.email, deliveredBy: emailRes.deliveredBy || 'skipped-dev' },
      'User registered (OTP dispatched)'
    );
    return res.status(201).json({
      message: 'User registered successfully. Please verify OTP sent to your email.',
      _id: user._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      otpSent: emailRes.delivered === true,
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Registration failed');
    return res.status(500).json({ message: 'Registration failed' });
  }
};

exports.verifyOTP = async (req, res) => {
  const errorRes = sendValidationResult(req, res);
  if (errorRes) return errorRes;

  try {
    const { userId, otp } = matchedData(req);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User already verified. Please login.' });
    }

    if (!user.otpHash || !user.otpExpiry) {
      return res.status(400).json({ message: 'No OTP found. Please register again.' });
    }

    if (Date.now() > user.otpExpiry.getTime()) {
      user.clearOtp();
      await user.save();
      return res.status(400).json({ message: 'OTP has expired. Please register again.' });
    }

    const isOtpValid = await user.matchOtp(otp);
    if (!isOtpValid) {
      logger.warn({ userId }, 'Invalid OTP attempt');
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    user.isVerified = true;
    user.clearOtp();
    await user.save();

    logger.info({ userId: user._id, email: user.email }, 'OTP verified');
    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
      message: 'Email verified successfully!',
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'OTP verification failed');
    return res.status(500).json({ message: 'Verification failed' });
  }
};

exports.loginUser = async (req, res) => {
  const errorRes = sendValidationResult(req, res);
  if (errorRes) return errorRes;

  try {
    const { email, password } = matchedData(req);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const remaining = Math.ceil((user.lockedUntil - Date.now()) / 1000);
      logger.warn({ email, remainingSeconds: remaining }, 'Login blocked: account locked');
      return res.status(423).json({
        message: `Account temporarily locked. Try again in ${remaining} seconds.`,
        retryAfterSeconds: remaining,
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        message: 'Please verify your email first',
        userId: user._id,
      });
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        logger.warn({ email }, `Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts`);
      }
      await user.save();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    logger.info({ userId: user._id, email: user.email }, 'User logged in');
    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
      message: 'Login successful!',
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Login failed');
    return res.status(500).json({ message: 'Login failed' });
  }
};

exports.resendOtp = async (req, res) => {
  const errorRes = sendValidationResult(req, res);
  if (errorRes) return errorRes;

  try {
    const { email } = matchedData(req);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'No account found with that email.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'This email is already verified. Please log in.' });
    }

    if (user.otpExpiry && user.otpExpiry > Date.now() - 60 * 1000) {
      const remaining = Math.ceil((60 * 1000 - (Date.now() - (user.otpExpiry.getTime() - 10 * 60 * 1000))) / 1000);
      return res.status(429).json({
        message: `Please wait ${remaining}s before requesting a new code.`,
        retryAfterSeconds: remaining,
      });
    }

    const otp = generateOTP();
    await user.setOtp(otp);
    await user.save();

    const message = `Your OTP for verification is: ${otp}\n\nThis OTP is valid for 10 minutes.`;

    // FIX #4: AWAIT sendEmail() and return 500 if it fails.
    const emailRes = await sendEmail({
      email: user.email,
      subject: 'Email Verification OTP - SmartReach AI',
      message,
    });
    if (!emailRes.success) {
      logger.warn(
        { userId: user._id, email: user.email, emailRes },
        'Resend-OTP failed to deliver — returning 500'
      );
      return res.status(500).json({
        message: 'Failed to resend OTP email. Please retry in 30 seconds.',
        emailError: emailRes.error,
      });
    }

    logger.info(
      { userId: user._id, email: user.email, deliveredBy: emailRes.deliveredBy || 'skipped-dev' },
      'OTP resent'
    );
    return res.status(200).json({
      message: 'A new verification code has been sent.',
      userId: user._id,
      email: user.email,
      otpSent: emailRes.delivered === true,
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Resend OTP failed');
    return res.status(500).json({ message: 'Failed to resend code' });
  }
};

// ================================================================
// Forgot Password — sends OTP to request a reset
// ================================================================
exports.forgotPassword = async (req, res) => {
  const errorRes = sendValidationResult(req, res);
  if (errorRes) return errorRes;

  try {
    const { email } = matchedData(req);
    const user = await User.findOne({ email: email.toLowerCase() });

    // NOTE: Deliberately return a success-shaped response even if the email
    // doesn't exist so attackers cannot enumerate which emails are
    // registered. Error only logged server-side.
    if (!user) {
      logger.info({ email }, 'Forgot-password request for non-existent email (silent)');
      return res.status(200).json({
        message:
          'If that email is registered, a password-reset OTP has been sent to it.',
      });
    }

    // Rate limit: 1 reset OTP per minute per user (account-level throttle,
    // distinct from the IP-level strictLimiter in routes).
    if (user.resetOtpExpiry && user.resetOtpExpiry > Date.now() - 60 * 1000) {
      const remaining = Math.ceil(
        (60 * 1000 - (Date.now() - (user.resetOtpExpiry.getTime() - 10 * 60 * 1000))) / 1000
      );
      return res.status(429).json({
        message: `Please wait ${remaining}s before requesting a new reset code.`,
        retryAfterSeconds: remaining,
      });
    }

    const otp = generateOTP();
    await user.setResetOtp(otp);
    await user.save();

    const message =
      `Your password reset OTP is: ${otp}\n\n` +
      `This OTP is valid for 10 minutes and can only be used once.\n` +
      `If you did not request a password reset, you can safely ignore this email.`;

    const emailRes = await sendEmail({
      email: user.email,
      subject: 'Password Reset OTP - SmartReach AI',
      message,
    });
    if (!emailRes.success) {
      logger.warn(
        { userId: user._id, email: user.email, emailRes },
        'Forgot-password OTP email failed to deliver'
      );
      return res.status(500).json({
        message: 'Failed to send password reset OTP email. Please retry in 30 seconds.',
        emailError: emailRes.error,
      });
    }

    logger.info(
      { userId: user._id, email: user.email, deliveredBy: emailRes.deliveredBy || 'skipped-dev' },
      'Forgot-password OTP dispatched'
    );
    return res.status(200).json({
      message: 'If that email is registered, a password-reset OTP has been sent to it.',
      userId: user._id,
      email: user.email,
      otpSent: emailRes.delivered === true,
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Forgot password failed');
    return res.status(500).json({ message: 'Failed to process request' });
  }
};

// ================================================================
// Reset Password — verifies OTP + replaces password, logs user in
// ================================================================
exports.resetPassword = async (req, res) => {
  const errorRes = sendValidationResult(req, res);
  if (errorRes) return errorRes;

  try {
    const { email, otp, password } = matchedData(req);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'No account found with that email.' });
    }

    if (!user.resetOtpHash || !user.resetOtpExpiry) {
      return res.status(400).json({
        message: 'No password reset request found. Please request a reset code first.',
      });
    }

    if (Date.now() > user.resetOtpExpiry.getTime()) {
      user.clearResetOtp();
      await user.save();
      return res.status(400).json({
        message: 'Reset OTP has expired. Please request a new one.',
      });
    }

    const isOtpValid = await user.matchResetOtp(otp);
    if (!isOtpValid) {
      logger.warn({ userId: user._id }, 'Invalid reset OTP attempt');
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    // Invalidate the reset OTP, set the new password, also unlock account if locked
    user.clearResetOtp();
    user.password = password; // pre-save hook hashes this automatically
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();

    logger.info({ userId: user._id, email: user.email }, 'Password reset completed');
    return res.status(200).json({
      message: 'Password reset successfully! You may now log in.',
      token: generateToken(user._id),
      _id: user._id,
      email: user.email,
      name: user.name,
      isVerified: user.isVerified,
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Reset password failed');
    return res.status(500).json({ message: 'Failed to reset password' });
  }
};
