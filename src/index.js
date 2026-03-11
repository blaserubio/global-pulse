import * as Sentry from '@sentry/node';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config/index.js';
import routes from './api/routes.js';
import { requireAdminKey } from './api/middleware/adminAuth.js';
import logger from './utils/logger.js';

// Initialize Sentry (must be before Express)
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
  logger.info('Sentry initialized');
}

const app = express();

// Trust proxy in production (Railway, Vercel, etc.)
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// Sentry request handler (must be first middleware)
if (config.sentryDsn) {
  app.use(Sentry.Handlers.requestHandler());
}

// Security & middleware
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", config.cors.origin],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.nodeEnv === 'production'
    ? config.cors.origin
    : [config.cors.origin, 'http://localhost:3001'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Admin-Key'],
  maxAge: 86400,
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Rate limiting — global
app.use('/api/', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
}));

// Stricter rate limit for search endpoints (expensive queries)
app.use('/api/v1/headlines', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests. Please slow down.' },
}));
app.use('/api/v1/stories', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests. Please slow down.' },
}));

// Very strict limit for admin routes
app.use('/api/v1/admin', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Admin rate limit exceeded.' },
}));

// Request logging
app.use((req, _res, next) => {
  if (req.path !== '/api/v1/health') {
    logger.debug(`${req.method} ${req.path}`, { query: req.query });
  }
  next();
});

// BullMQ Dashboard is only available via /admin/queues when workers are running
// Not loaded on startup to avoid Redis connection crashes

// Routes
app.use('/api/v1', routes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Sentry error handler (must be before custom error handler)
if (config.sentryDsn) {
  app.use(Sentry.Handlers.errorHandler());
}

// Error handler
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  logger.info(`Global Pulse API running on port ${config.port}`);
});

// Graceful shutdown
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
