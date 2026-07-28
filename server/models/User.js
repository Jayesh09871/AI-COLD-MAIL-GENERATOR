const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      index: true,
    },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false, index: true },
    otpHash: { type: String },
    otpExpiry: { type: Date },
    resetOtpHash: { type: String },
    resetOtpExpiry: { type: Date },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    // ================================================================
    // AUTO-CLEANUP for UNVERIFIED users (MongoDB TTL index).
    // Set only when the user first registers (isVerified: false).
    // MongoDB's background TTL monitor will DELETE this document
    // automatically at the timestamp below unless the user completes
    // OTP verification — at which point we clear autoDeleteAt and
    // the user becomes permanent.
    //
    // NOTE: TTL index on this field uses expireAfterSeconds: 0 so
    // the exact Date stored controls expiry.
    // ================================================================
    autoDeleteAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // +24h
      index: { expireAfterSeconds: 0, partialFilterExpression: { isVerified: false } },
    },
  },
  { timestamps: true }
);

// TTL index (declarative version, applied on next mongoose connect).
// Partial filter: only rows where isVerified === false are eligible for auto-delete.
// Verified users (isVerified: true + autoDeleteAt cleared above → null) skip the index
// and live forever (normal accounts).
// NOTE: we keep the field-level index above so Mongoose creates it. This is a
// safety-net fallback via schema.index() for older Mongoose versions.
userSchema.index(
  { autoDeleteAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { isVerified: false },
    background: true,
  }
);

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  if (this.isModified('otpHash') && this.otpHash && !this.otpHash.startsWith('$2')) {
    const salt = await bcrypt.genSalt(10);
    this.otpHash = await bcrypt.hash(this.otpHash, salt);
  }
  if (this.isModified('resetOtpHash') && this.resetOtpHash && !this.resetOtpHash.startsWith('$2')) {
    const salt = await bcrypt.genSalt(10);
    this.resetOtpHash = await bcrypt.hash(this.resetOtpHash, salt);
  }
  // ---------------------------------------------------------------
  // When a user VERIFIES (isVerified transitions false → true), clear
  // the autoDeleteAt timestamp so MongoDB's TTL monitor no longer
  // considers this document for expiration. Verified accounts live on.
  // ---------------------------------------------------------------
  if (this.isModified('isVerified') && this.isVerified === true) {
    this.autoDeleteAt = undefined;
  }
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.matchOtp = async function (enteredOtp) {
  if (!this.otpHash) return false;
  return bcrypt.compare(enteredOtp, this.otpHash);
};

userSchema.methods.matchResetOtp = async function (enteredOtp) {
  if (!this.resetOtpHash) return false;
  return bcrypt.compare(enteredOtp, this.resetOtpHash);
};

userSchema.methods.setOtp = async function (otp) {
  const salt = await bcrypt.genSalt(10);
  this.otpHash = await bcrypt.hash(otp, salt);
  this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
};

userSchema.methods.clearOtp = function () {
  this.otpHash = undefined;
  this.otpExpiry = undefined;
};

userSchema.methods.setResetOtp = async function (otp) {
  const salt = await bcrypt.genSalt(10);
  this.resetOtpHash = await bcrypt.hash(otp, salt);
  this.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
};

userSchema.methods.clearResetOtp = function () {
  this.resetOtpHash = undefined;
  this.resetOtpExpiry = undefined;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
