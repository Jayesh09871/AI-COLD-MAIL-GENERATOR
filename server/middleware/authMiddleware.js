const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -otpHash -failedLoginAttempts -lockedUntil');

    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Email not verified' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn({ error: error.message, path: req.originalUrl }, 'Auth failed');
    return res
      .status(401)
      .json({ message: 'Not authorized, token failed', error: error.name === 'TokenExpiredError' ? 'expired' : undefined });
  }
};

module.exports = { protect };
