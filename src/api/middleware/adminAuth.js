import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Middleware that requires a valid admin API key.
 * The key is passed via the X-Admin-Key header.
 * Skipped in development if no ADMIN_API_KEY is configured.
 */
export function requireAdminKey(req, res, next) {
  const adminKey = config.adminApiKey;

  // In development, skip auth if no key is configured
  if (!adminKey && config.nodeEnv === 'development') {
    return next();
  }

  if (!adminKey) {
    logger.error('ADMIN_API_KEY not configured — admin routes are disabled');
    return res.status(503).json({ error: 'Admin routes not configured' });
  }

  const key = req.headers['x-admin-key'];

  if (!key || key !== adminKey) {
    logger.warn('Unauthorized admin access attempt', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
