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
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  { timestamps: true }
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
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.matchOtp = async function (enteredOtp) {
  if (!this.otpHash) return false;
  return bcrypt.compare(enteredOtp, this.otpHash);
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

const User = mongoose.model('User', userSchema);
module.exports = User;
