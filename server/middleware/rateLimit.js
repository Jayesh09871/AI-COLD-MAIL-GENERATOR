const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const createLimiter = ({ name, windowMs, max, skipSuccessfulRequests = false, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: message || {
      message: `Too many requests for ${name}. Please try again later.`,
      retryAfterMs: windowMs,
    },
    handler: (req, res, next, options) => {
      logger.warn(
        {
          rateLimitName: name,
          ip: req.ip,
          path: req.originalUrl,
          limit: max,
          windowMs,
        },
        'Rate limit exceeded'
      );
      res.status(options.statusCode).json(options.message);
    },
  });

const strictLimiter = createLimiter({
  name: 'strict',
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.STRICT_RATE_LIMIT_MAX || '5', 10),
});

const authLimiter = createLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
});

const generateLimiter = createLimiter({
  name: 'generate-ai',
  windowMs: 60 * 1000,
  max: parseInt(process.env.GENERATE_RATE_LIMIT_MAX || '10', 10),
  message: {
    message: 'Too many AI generation requests. Please wait a moment before trying again.',
    retryAfterMs: 60 * 1000,
  },
});

const historyReadLimiter = createLimiter({
  name: 'history-read',
  windowMs: 60 * 1000,
  max: parseInt(process.env.HISTORY_RATE_LIMIT_MAX || '60', 10),
});

const apiLimiter = createLimiter({
  name: 'global-api',
  windowMs: 60 * 1000,
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || '200', 10),
});

module.exports = {
  strictLimiter,
  authLimiter,
  generateLimiter,
  historyReadLimiter,
  apiLimiter,
};
