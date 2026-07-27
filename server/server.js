const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const crypto = require('crypto');
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');

dotenv.config();

// FIX #1: Default NODE_ENV to "production" so deployed services (Render/Heroku/etc)
// never accidentally run with dev-only CORS/error-masking/console-leaks even if
// NODE_ENV is not explicitly set in the hosting env vars.
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'GROQ_API_KEY'];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error({ missingVars: missingEnvVars }, 'Missing required environment variables');
  process.exit(1);
}

connectDB();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// FIX #2a: Parse FRONTEND_URL into a robust allow-list that tolerates:
//  - trailing slashes    (FRONTEND_URL="https://x.vercel.app/"  vs  Origin "https://x.vercel.app")
//  - comma-separated list (FRONTEND_URL="https://x.vercel.app,https://www.x.vercel.app,https://preview-x.vercel.app")
//  - www vs non-www       (we auto-add the opposite www/non-www form for every https origin)
//  - empty string / unset (safe fallback)
const normalizeOrigin = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  // strip trailing slash(es)
  s = s.replace(/\/+$/, '');
  // lowercase scheme+host (Origin is case-insensitive)
  try {
    const u = new URL(s);
    return u.origin;  // scheme + host + port, no path, normalized
  } catch {
    return s.toLowerCase();
  }
};
const expandWwwVariants = (origin) => {
  if (!origin) return [];
  const out = new Set([origin]);
  // Only expand https origins with hostname (skip raw IPs / localhost / custom schemes)
  const m = origin.match(/^https:\/\/([^/:]+)(:\d+)?$/);
  if (m) {
    const host = m[1];
    const port = m[2] || '';
    if (host.startsWith('www.')) {
      out.add(`https://${host.slice(4)}${port}`);
    } else if (!/^\d+\.\d+\.\d+\.\d+$/.test(host) && host !== 'localhost') {
      out.add(`https://www.${host}${port}`);
    }
  }
  return Array.from(out);
};
const rawFrontends = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);
const explicitAllowedOrigins = new Set();
rawFrontends.forEach((o) => expandWwwVariants(o).forEach((v) => explicitAllowedOrigins.add(v)));

// Build helmet CSP list from the same origins so there is NO drift between CORS and CSP
const helmetCspConnectSrc = Array.from(explicitAllowedOrigins);
if (!helmetCspConnectSrc.length) {
  helmetCspConnectSrc.push("'self'");
}
helmetCspConnectSrc.push('https://api.groq.com');

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health' || req.url?.startsWith('/health'),
    },
  })
);

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('hex');
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': [
          "'self'",
          ...helmetCspConnectSrc,
        ],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
      },
    },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true,
  })
);

app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.ieNoOpen());
app.use(helmet.dnsPrefetchControl());

const allowedOrigins = new Set(explicitAllowedOrigins);
if (isDevelopment) {
  ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000']
    .forEach((o) => allowedOrigins.add(o));
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        if (isDevelopment) return callback(null, true);
        return callback(new Error('Not allowed by CORS: missing origin'));
      }
      // Normalize incoming origin the same way we normalized FRONTEND_URL so
      // trailing slashes / case differences never cause a false block.
      const normalized = normalizeOrigin(origin);
      if (normalized && allowedOrigins.has(normalized)) {
        callback(null, true);
      } else {
        logger.warn({ origin, normalized, allowed: Array.from(allowedOrigins) }, 'CORS blocked request');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  })
);

app.use(
  express.json({
    limit: process.env.MAX_BODY_SIZE || '100kb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.MAX_BODY_SIZE || '100kb',
  })
);

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitizeValue = (val) => {
      if (typeof val === 'string') return val.replace(/\0/g, '');
      if (Array.isArray(val)) return val.map(sanitizeValue);
      if (val && typeof val === 'object') {
        const out = {};
        for (const k of Object.keys(val)) out[k] = sanitizeValue(val[k]);
        return out;
      }
      return val;
    };
    req.body = sanitizeValue(req.body);
  }
  next();
});

app.get('/health', async (req, res) => {
  const startTime = Date.now();
  const checks = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
  };

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const dbPing = await mongoose.connection.db.admin().ping();
      checks.database = {
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        ok: dbPing.ok,
      };
    } else {
      checks.database = {
        status: 'unhealthy',
        readyState: mongoose.connection?.readyState,
      };
    }
  } catch (err) {
    checks.database = { status: 'unhealthy', error: err.message };
  }

  const allHealthy = checks.database && checks.database.status === 'healthy';
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    ...checks,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);

// RENDER BUG FIX: Guard client/dist static serving with existence check.
//
// Why: On Render the backend uses Root Directory = "server" and the client
// is deployed separately on Vercel. The path `../client/dist` does not exist
// inside Render's built image (we never ran `npm run build` inside the
// server/ service), and the prior unguarded code threw:
//   {"message":"ENOENT: no such file or directory, stat '/client/dist/index.html'"}
// on any non-API route (including / favicon.ico hits from browsers, which
// would bubble up to the error handler as a scary 500).
//
// Behaviors after fix:
//   - client/dist EXISTS (local full-monorepo dev): serve static assets +
//     SPA index.html fallback exactly as before — full backwards compat.
//   - client/dist MISSING (Render / pure API deployments): skip mounting
//     the static middleware entirely and, instead of trying sendFile on a
//     nonexistent path, return a clean JSON 404 pointing the user at the
//     real frontend URL (from FRONTEND_URL env var) so they aren't lost.
const __dirnamePath = path.resolve();
const clientBuildPath = path.join(__dirnamePath, '..', 'client', 'dist');
const clientDistExists = fs.existsSync(clientBuildPath);

if (clientDistExists) {
  logger.info({ clientBuildPath }, 'Serving client SPA from client/dist');
  app.use(express.static(clientBuildPath));
} else {
  logger.info(
    { clientBuildPath, frontendUrl: process.env.FRONTEND_URL || null },
    'client/dist not found — running API-only mode. Frontend expected at FRONTEND_URL',
  );
}

app.get('*', (req, res, next) => {
  // Never intercept API/health routes — always let them hit router/404
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  if (clientDistExists) {
    return res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
  // API-only deployment (Render + Vercel-split) — guide the user to the
  // correct frontend URL so they don't see a raw ENOENT 500.
  const frontend = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')[0].trim().replace(/\/+$/, '')
    : null;
  if (frontend) {
    return res.status(404).json({
      message: 'This service runs in API-only mode. Visit the frontend URL to use the app.',
      frontendUrl: frontend,
      path: req.originalUrl,
      docs: 'Set client/dist to serve SPA from this server, or host frontend separately (recommended on Vercel).',
    });
  }
  return next();
});

app.use((req, res) => {
  res.status(404).json({
    message: 'Resource not found',
    path: req.originalUrl,
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const reqId = req.id || crypto.randomUUID();
  const logContext = {
    err,
    method: req.method,
    url: req.originalUrl,
    requestId: reqId,
  };

  if (err && err.type === 'entity.parse.failed') {
    logger.warn(logContext, 'Malformed JSON payload');
    return res.status(400).json({ message: 'Invalid JSON payload', requestId: reqId });
  }

  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    logger.warn(logContext, 'File too large');
    return res.status(413).json({ message: 'Payload too large', requestId: reqId });
  }

  logger.error(logContext, 'Unhandled error');

  const publicMessage =
    isProduction && (!err.statusCode || err.statusCode >= 500)
      ? 'Internal server error'
      : err.message || 'Server error';

  res.status(err.statusCode || 500).json({
    message: publicMessage,
    requestId: reqId,
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(
    { port: PORT, environment: isProduction ? 'production' : 'development' },
    `Server running on port ${PORT}`
  );
});

const gracefulShutdown = async (signal) => {
  logger.info({ signal }, `${signal} received — shutting down gracefully`);
  let forceTimer = setTimeout(() => {
    logger.error('Forcing shutdown after 10s timeout');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    logger.info('HTTP server closed');
  } catch (err) {
    logger.warn({ error: err.message }, 'HTTP server close reported an error');
  }

  try {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.warn({ error: err.message }, 'Mongo disconnect reported an error');
  }

  clearTimeout(forceTimer);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

module.exports = app;
