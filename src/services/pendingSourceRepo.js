import { query } from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Insert or update a pending source. Increments times_seen and appends sample article.
 * @param {string} name
 * @param {string|null} url
 * @param {string|null} countryCode
 * @param {string|null} region
 * @param {object|null} sampleArticle - { title, url, published_at }
 */
export async function upsertPendingSource(name, url, countryCode, region, sampleArticle) {
  const sample = sampleArticle ? JSON.stringify(sampleArticle) : null;

  const result = await query(
    `INSERT INTO pending_sources (name, url, country_code, region, sample_articles)
     VALUES ($1, $2, $3, $4, CASE WHEN $5::jsonb IS NOT NULL THEN jsonb_build_array($5::jsonb) ELSE '[]'::jsonb END)
     ON CONFLICT (name) DO UPDATE SET
       times_seen = pending_sources.times_seen + 1,
       last_seen = NOW(),
       url = COALESCE(EXCLUDED.url, pending_sources.url),
       country_code = COALESCE(EXCLUDED.country_code, pending_sources.country_code),
       region = COALESCE(EXCLUDED.region, pending_sources.region),
       sample_articles = CASE
         WHEN jsonb_array_length(pending_sources.sample_articles) < 10 AND $5::jsonb IS NOT NULL
         THEN pending_sources.sample_articles || jsonb_build_array($5::jsonb)
         ELSE pending_sources.sample_articles
       END
     RETURNING times_seen`,
    [name, url || null, countryCode || null, region || null, sample]
  );

  const timesSeen = result.rows[0]?.times_seen || 1;
  logger.debug(`Queued unknown source for review: ${name}, seen ${timesSeen} times`);
  return timesSeen;
}

/**
 * Get pending sources with optional filters.
 * @param {object} opts
 * @returns {Promise<{ sources: object[], total: number }>}
 */
export async function getPendingSources({ status, minTimesSeen, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }
  if (minTimesSeen) {
    conditions.push(`times_seen >= $${paramIdx++}`);
    params.push(minTimesSeen);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)::int FROM pending_sources ${where}`,
    params
  );

  const result = await query(
    `SELECT * FROM pending_sources ${where}
     ORDER BY times_seen DESC, last_seen DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { sources: result.rows, total: countResult.rows[0].count };
}

/**
 * Update the review status of a pending source.
 * @param {string} id
 * @param {string} status - 'approved', 'rejected', or 'ignored'
 */
export async function reviewSource(id, status) {
  const result = await query(
    `UPDATE pending_sources SET status = $2, reviewed_at = NOW() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return result.rows[0] || null;
}

/**
 * Promote a pending source to the active sources table.
 * @param {string} pendingId
 * @param {object} sourceData - Full source metadata
 * @returns {Promise<object|null>}
 */
export async function promoteSource(pendingId, sourceData) {
  // Get the pending source
  const pending = await query(`SELECT * FROM pending_sources WHERE id = $1`, [pendingId]);
  if (pending.rows.length === 0) return null;

  const p = pending.rows[0];

  // Insert into active sources
  const result = await query(
    `INSERT INTO sources (name, slug, url, country_code, region, language, rss_feeds,
       funding_model, editorial_lean, factual_rating, ownership, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
     RETURNING *`,
    [
      sourceData.name || p.name,
      sourceData.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      sourceData.url || p.url,
      sourceData.country_code || p.country_code,
      sourceData.region || p.region,
      sourceData.language || 'en',
      JSON.stringify(sourceData.rss_feeds || []),
      sourceData.funding_model || 'unknown',
      sourceData.editorial_lean || 'unknown',
      sourceData.factual_rating || 'unknown',
      sourceData.ownership || 'unknown',
    ]
  );

  // Mark as approved
  await query(
    `UPDATE pending_sources SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
    [pendingId]
  );

  return result.rows[0];
}

/**
 * Store AI assessment for a pending source.
 * @param {string} id
 * @param {object} assessment
 */
export async function updateAiAssessment(id, assessment) {
  await query(
    `UPDATE pending_sources SET ai_assessment = $2 WHERE id = $1`,
    [id, JSON.stringify(assessment)]
  );
}

/**
 * Get sources ready for AI assessment (seen frequently, no assessment yet).
 * @param {number} minTimesSeen
 * @param {number} limit
 */
export async function getSourcesNeedingAssessment(minTimesSeen = 5, limit = 10) {
  const result = await query(
    `SELECT * FROM pending_sources
     WHERE status = 'pending'
       AND times_seen >= $1
       AND ai_assessment IS NULL
     ORDER BY times_seen DESC
     LIMIT $2`,
    [minTimesSeen, limit]
  );
  return result.rows;
}
