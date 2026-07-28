const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  registerUser,
  verifyOTP,
  loginUser,
  resendOtp,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { strictLimiter, authLimiter } = require('../middleware/rateLimit');

const isStrongPassword = (value) => {
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/\d/.test(value)) return false;
  return true;
};

router.post(
  '/register',
  strictLimiter,
  [
    body('name')
      .exists({ checkFalsy: true })
      .withMessage('Name is required')
      .isString()
      .withMessage('Name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .matches(/^[A-Za-zÀ-ÿ'\- ]+$/)
      .withMessage('Name may only contain letters, spaces, hyphens, and apostrophes'),
    body('email')
      .exists({ checkFalsy: true })
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail({ gmail_remove_dots: false, all_lowercase: true })
      .isLength({ max: 254 }),
    body('password')
      .exists({ checkFalsy: true })
      .withMessage('Password is required')
      .isString()
      .withMessage('Password must be a string')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .custom((value) => isStrongPassword(value))
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],
  registerUser
);

router.post(
  '/verify-otp',
  strictLimiter,
  [
    body('userId')
      .exists({ checkFalsy: true })
      .withMessage('User ID is required')
      .isMongoId()
      .withMessage('Invalid User ID format'),
    body('otp')
      .exists({ checkFalsy: true })
      .withMessage('OTP is required')
      .isString()
      .withMessage('OTP must be a string')
      .trim()
      .matches(/^\d{6}$/)
      .withMessage('OTP must be exactly 6 digits'),
  ],
  verifyOTP
);

router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .exists({ checkFalsy: true })
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail({ gmail_remove_dots: false, all_lowercase: true }),
    body('password')
      .exists({ checkFalsy: true })
      .withMessage('Password is required')
      .isString()
      .withMessage('Password must be a string')
      .isLength({ min: 1, max: 128 })
      .withMessage('Password must be between 1 and 128 characters'),
  ],
  loginUser
);

router.post(
  '/resend-otp',
  strictLimiter,
  [
    body('email')
      .exists({ checkFalsy: true })
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail({ gmail_remove_dots: false, all_lowercase: true }),
  ],
  resendOtp
);

// ================================================================
// Password recovery — OTP-based, same rate-limit tier as OTP routes
// ================================================================
router.post(
  '/forgot-password',
  strictLimiter,
  [
    body('email')
      .exists({ checkFalsy: true })
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail({ gmail_remove_dots: false, all_lowercase: true }),
  ],
  forgotPassword
);

router.post(
  '/reset-password',
  strictLimiter,
  [
    body('email')
      .exists({ checkFalsy: true })
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail({ gmail_remove_dots: false, all_lowercase: true }),
    body('otp')
      .exists({ checkFalsy: true })
      .withMessage('OTP is required')
      .isString()
      .withMessage('OTP must be a string')
      .trim()
      .matches(/^\d{6}$/)
      .withMessage('OTP must be exactly 6 digits'),
    body('password')
      .exists({ checkFalsy: true })
      .withMessage('New password is required')
      .isString()
      .withMessage('Password must be a string')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .custom((value) => isStrongPassword(value))
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],
  resetPassword
);

module.exports = router;
