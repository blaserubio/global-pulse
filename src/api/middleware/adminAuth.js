import { timingSafeEqual } from 'node:crypto';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Middleware that requires a valid admin API key.
 * The key is passed via the X-Admin-Key header.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function requireAdminKey(req, res, next) {
  const adminKey = config.adminApiKey;

  if (!adminKey) {
    if (config.nodeEnv === 'development') {
      logger.warn('ADMIN_API_KEY not set — admin routes unprotected in development');
      return next();
    }
    logger.error('ADMIN_API_KEY not configured — admin routes are disabled');
    return res.status(503).json({ error: 'Admin routes not configured' });
  }

  const key = req.headers['x-admin-key'];

  if (!key) {
    logger.warn('Unauthorized admin access attempt — no key provided', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Constant-time comparison to prevent timing attacks
  const keyBuf = Buffer.from(String(key));
  const adminBuf = Buffer.from(adminKey);

  if (keyBuf.length !== adminBuf.length || !timingSafeEqual(keyBuf, adminBuf)) {
    logger.warn('Unauthorized admin access attempt — invalid key', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
