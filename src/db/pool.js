import pg from 'pg';
import config from '../config/index.js';
import logger from '../utils/logger.js';
// config imported for nodeEnv check in slow query logging

const pool = new pg.Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PG pool error', { error: err.message });
});

/**
 * Execute a parameterized query and return rows.
 * @param {string} text - SQL query with $1, $2... placeholders
 * @param {any[]} [params] - Parameter values
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    logger.warn('Slow query', {
      duration,
      ...(config.nodeEnv !== 'production' && { text: text.slice(0, 200) }),
    });
  }
  return result;
}

/**
 * Run a callback inside a database transaction.
 * @param {(client: pg.PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check database connectivity.
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export default pool;
