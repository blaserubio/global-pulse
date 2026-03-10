import { query, transaction } from '../db/pool.js';
import { simhash, isNearDuplicate } from '../utils/dedup.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Check if an article URL already exists.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function urlExists(url) {
  const result = await query(
    `SELECT 1 FROM articles WHERE url = $1 LIMIT 1`,
    [url]
  );
  return result.rows.length > 0;
}

/**
 * Check for near-duplicate content via SimHash within a 7-day window.
 * Uses hash prefix pre-filter to reduce candidate set.
 * @param {string} contentHash
 * @returns {Promise<string|null>} canonical_id if duplicate found, null otherwise
 */
export async function findNearDuplicate(contentHash) {
  const hashPrefix = contentHash.slice(0, 4);
  const result = await query(
    `SELECT id, content_hash FROM articles
     WHERE ingested_at > NOW() - INTERVAL '7 days'
       AND content_hash IS NOT NULL
       AND LEFT(content_hash, 4) = $1
     ORDER BY ingested_at DESC
     LIMIT 200`,
    [hashPrefix]
  );
  for (const row of result.rows) {
    if (isNearDuplicate(contentHash, row.content_hash)) {
      return row.id;
    }
  }
  return null;
}

/**
 * Insert a normalized article. Returns null if duplicate.
 * @param {object} article - Normalized article data
 * @returns {Promise<object|null>} Inserted article or null if skipped
 */
export async function insertArticle(article) {
  // Check URL duplicate
  if (await urlExists(article.url)) {
    return null;
  }

  // Generate content hash
  const text = `${article.title} ${article.body_text}`;
  const contentHash = simhash(text);

  // Check content duplicate
  const canonicalId = await findNearDuplicate(contentHash);

  const id = uuidv4();
  try {
    const result = await query(
      `INSERT INTO articles (id, source_id, title, body_text, url, image_url, author, language, content_hash, canonical_id, published_at, ingested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (url) DO NOTHING
       RETURNING *`,
      [
        id,
        article.source_id,
        article.title,
        article.body_text,
        article.url,
        article.image_url,
        article.author,
        article.language,
        contentHash,
        canonicalId || id,
        article.published_at,
      ]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (err) {
    logger.error('Failed to insert article', { url: article.url, error: err.message });
    return null;
  }
}

/**
 * Get paginated headlines with source metadata.
 * @param {object} filters
 * @returns {Promise<{ articles: object[], total: number }>}
 */
export async function getHeadlines({ topic, region, language, since, search, limit = 20, offset = 0 }) {
  const conditions = ['a.canonical_id = a.id']; // Exclude duplicates
  const params = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(COALESCE(a.translated_title, a.title) ILIKE $${paramIdx} OR a.title ILIKE $${paramIdx} OR a.body_text ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (topic) {
    conditions.push(`a.topic = $${paramIdx++}`);
    params.push(topic);
  }
  if (region) {
    conditions.push(`s.region = $${paramIdx++}`);
    params.push(region);
  }
  if (language) {
    conditions.push(`a.language = $${paramIdx++}`);
    params.push(language);
  }
  if (since) {
    conditions.push(`a.published_at >= $${paramIdx++}`);
    params.push(since);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM articles a JOIN sources s ON s.id = a.source_id ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const articlesResult = await query(
    `SELECT a.id, COALESCE(a.translated_title, a.title) AS title, a.title AS original_title,
            a.summary, a.url, a.image_url, a.author, a.language,
            a.topic, a.sub_topic, a.published_at, a.ingested_at,
            json_build_object(
              'id', s.id, 'name', s.name, 'slug', s.slug, 'url', s.url,
              'country_code', s.country_code, 'region', s.region,
              'funding_model', s.funding_model, 'editorial_lean', s.editorial_lean,
              'factual_rating', s.factual_rating, 'ownership', s.ownership
            ) AS source
     FROM articles a
     JOIN sources s ON s.id = a.source_id
     ${where}
     ORDER BY a.published_at DESC NULLS LAST
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { articles: articlesResult.rows, total };
}

/**
 * Get a single article by ID with full source metadata.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getArticleById(id) {
  const result = await query(
    `SELECT a.*,
            json_build_object(
              'id', s.id, 'name', s.name, 'slug', s.slug, 'url', s.url,
              'country_code', s.country_code, 'region', s.region, 'language', s.language,
              'funding_model', s.funding_model, 'editorial_lean', s.editorial_lean,
              'factual_rating', s.factual_rating, 'ownership', s.ownership
            ) AS source
     FROM articles a
     JOIN sources s ON s.id = a.source_id
     WHERE a.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get topic distribution for the last N hours.
 * @param {number} hours
 * @returns {Promise<object[]>}
 */
export async function getTopicStats(hours = 24) {
  const result = await query(
    `SELECT topic, COUNT(*)::int AS count
     FROM articles
     WHERE published_at > NOW() - INTERVAL '1 hour' * $1
       AND topic IS NOT NULL
     GROUP BY topic
     ORDER BY count DESC`,
    [hours]
  );
  return result.rows;
}

/**
 * Get regional distribution for the last N hours.
 * @param {number} hours
 * @returns {Promise<object[]>}
 */
export async function getRegionStats(hours = 24) {
  const result = await query(
    `SELECT s.region, COUNT(*)::int AS count
     FROM articles a
     JOIN sources s ON s.id = a.source_id
     WHERE a.ingested_at > NOW() - INTERVAL '1 hour' * $1
     GROUP BY s.region
     ORDER BY count DESC`,
    [hours]
  );
  return result.rows;
}

/**
 * Get overview stats.
 * @returns {Promise<object>}
 */
export async function getOverviewStats() {
  const [totalRes, last24hRes, sourcesRes, topicStats, regionStats] = await Promise.all([
    query(`SELECT COUNT(*)::int AS count FROM articles`),
    query(`SELECT COUNT(*)::int AS count FROM articles WHERE ingested_at > NOW() - INTERVAL '24 hours'`),
    query(`SELECT COUNT(*)::int AS count FROM sources WHERE is_active = true`),
    getTopicStats(24),
    getRegionStats(24),
  ]);
  return {
    total_articles: totalRes.rows[0].count,
    articles_last_24h: last24hRes.rows[0].count,
    active_sources: sourcesRes.rows[0].count,
    topics: topicStats,
    regions: regionStats,
  };
}
