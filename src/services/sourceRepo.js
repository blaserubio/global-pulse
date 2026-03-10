import { query } from '../db/pool.js';

/**
 * Get all active sources.
 * @returns {Promise<object[]>}
 */
export async function getActiveSources() {
  const result = await query(
    `SELECT * FROM sources WHERE is_active = true ORDER BY name`
  );
  return result.rows;
}

/**
 * Get all sources with 24h article counts and bias metadata.
 * @returns {Promise<object[]>}
 */
export async function getSourcesWithStats() {
  const result = await query(`
    SELECT s.*,
      COALESCE(c.article_count, 0)::int AS article_count_24h
    FROM sources s
    LEFT JOIN (
      SELECT source_id, COUNT(*) AS article_count
      FROM articles
      WHERE ingested_at > NOW() - INTERVAL '24 hours'
      GROUP BY source_id
    ) c ON c.source_id = s.id
    ORDER BY s.name
  `);
  return result.rows;
}

/**
 * Find a source by slug.
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function findBySlug(slug) {
  const result = await query(`SELECT * FROM sources WHERE slug = $1`, [slug]);
  return result.rows[0] || null;
}

/**
 * Find a source by name (case-insensitive partial match).
 * @param {string} name
 * @returns {Promise<object|null>}
 */
export async function findByName(name) {
  const result = await query(
    `SELECT * FROM sources WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  return result.rows[0] || null;
}

/**
 * Insert an ingestion log record.
 * @param {object} log
 * @returns {Promise<object>}
 */
export async function insertIngestionLog(log) {
  const result = await query(
    `INSERT INTO ingestion_logs (source_id, feed_url, status, articles_found, articles_new, articles_duped, error_message, started_at, completed_at, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      log.source_id,
      log.feed_url,
      log.status,
      log.articles_found || 0,
      log.articles_new || 0,
      log.articles_duped || 0,
      log.error_message || null,
      log.started_at,
      log.completed_at,
      log.duration_ms || 0,
    ]
  );
  return result.rows[0];
}
