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

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      logger.info({ email }, 'Registration attempt with existing email');
      return res.status(400).json({ message: 'Email already registered. Please try logging in.' });
    }

    const otp = generateOTP();
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
    });
    await user.setOtp(otp);
    await user.save();

    const message = `Your OTP for verification is: ${otp}\n\nThis OTP is valid for 10 minutes.`;
    sendEmail({ email: user.email, subject: 'Email Verification OTP - SmartReach AI', message }).catch(
      (error) => logger.warn({ email: user.email, error: error.message }, 'Background OTP email failed')
    );

    logger.info({ userId: user._id, email: user.email }, 'User registered');
    return res.status(201).json({
      message: 'User registered successfully. Please verify OTP sent to your email.',
      _id: user._id,
      userId: user._id,
      name: user.name,
      email: user.email,
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
    sendEmail({ email: user.email, subject: 'Email Verification OTP - SmartReach AI', message }).catch(
      (error) => logger.warn({ email: user.email, error: error.message }, 'Background OTP email failed')
    );

    logger.info({ userId: user._id, email: user.email }, 'OTP resent');
    return res.status(200).json({
      message: 'A new verification code has been sent.',
      userId: user._id,
      email: user.email,
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Resend OTP failed');
    return res.status(500).json({ message: 'Failed to resend code' });
  }
};
