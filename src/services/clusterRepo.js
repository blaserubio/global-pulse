import { query, transaction } from '../db/pool.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Get all articles with embeddings that are not yet clustered (last 48 hours).
 * @returns {Promise<object[]>}
 */
export async function getUnclusteredArticles() {
  const result = await query(
    `SELECT a.id, a.title, a.source_id, a.embedding,
            s.country_code, s.region
     FROM articles a
     JOIN sources s ON s.id = a.source_id
     WHERE a.embedding IS NOT NULL
       AND a.cluster_id IS NULL
       AND a.ingested_at > NOW() - INTERVAL '48 hours'
     ORDER BY a.published_at DESC`
  );
  return result.rows;
}

/**
 * Find nearest neighbors for an article using pgvector cosine distance.
 * @param {string} articleId
 * @param {number} limit
 * @param {number} maxDistance - Maximum cosine distance (1 - similarity)
 * @returns {Promise<object[]>}
 */
export async function findNearestNeighbors(articleId, limit = 20, maxDistance = 0.22) {
  // maxDistance = 1 - similarity_threshold; 0.22 = 1 - 0.78
  const result = await query(
    `SELECT a.id, a.title, a.cluster_id, a.source_id,
            s.country_code, s.region,
            a.embedding <=> (SELECT embedding FROM articles WHERE id = $1) AS distance
     FROM articles a
     JOIN sources s ON s.id = a.source_id
     WHERE a.embedding IS NOT NULL
       AND a.id <> $1
       AND a.ingested_at > NOW() - INTERVAL '48 hours'
     ORDER BY a.embedding <=> (SELECT embedding FROM articles WHERE id = $1)
     LIMIT $2`,
    [articleId, limit]
  );
  // Filter by max distance
  return result.rows.filter((r) => r.distance <= maxDistance);
}

/**
 * Create a new story cluster and assign articles to it.
 * @param {string[]} articleIds
 * @returns {Promise<object>} The created cluster
 */
export async function createCluster(articleIds) {
  const clusterId = uuidv4();

  return await transaction(async (client) => {
    // Create cluster
    await client.query(
      `INSERT INTO story_clusters (id, first_seen, last_updated, is_active)
       VALUES ($1, NOW(), NOW(), true)`,
      [clusterId]
    );

    // Assign articles
    await client.query(
      `UPDATE articles SET cluster_id = $1 WHERE id = ANY($2)`,
      [clusterId, articleIds]
    );

    // Compute cluster metadata
    const meta = await client.query(
      `SELECT
        COUNT(DISTINCT a.source_id)::int AS source_count,
        COUNT(DISTINCT s.country_code)::int AS country_count,
        COUNT(DISTINCT s.region)::int AS region_count,
        json_agg(DISTINCT s.region) AS regions,
        json_agg(DISTINCT s.country_code) AS countries
       FROM articles a
       JOIN sources s ON s.id = a.source_id
       WHERE a.cluster_id = $1`,
      [clusterId]
    );

    const m = meta.rows[0];
    const velocityData = await computeVelocity(client, clusterId, m);

    await client.query(
      `UPDATE story_clusters SET
        source_count = $2, country_count = $3, region_count = $4,
        significance = $5, regions = $6, countries = $7,
        velocity = $8, acceleration = $9, hours_since_update = $10
       WHERE id = $1`,
      [clusterId, m.source_count, m.country_count, m.region_count,
       velocityData.significance, JSON.stringify(m.regions), JSON.stringify(m.countries),
       velocityData.velocity, velocityData.acceleration, velocityData.hours_since_update]
    );

    return { id: clusterId, source_count: m.source_count, country_count: m.country_count, region_count: m.region_count, significance: velocityData.significance };
  });

  // Select best image for the cluster (non-blocking)
  selectClusterImage(clusterId).catch(() => {});

  return result;
}

/**
 * Select the best representative image for a cluster.
 * Prefers images from higher-factual-rating sources.
 */
async function selectClusterImage(clusterId) {
  const articles = await query(
    `SELECT a.id, a.image_url, s.factual_rating
     FROM articles a JOIN sources s ON a.source_id = s.id
     WHERE a.cluster_id = $1 AND a.image_url IS NOT NULL
     ORDER BY a.published_at DESC`,
    [clusterId]
  );

  if (articles.rows.length === 0) return;

  const ratingScores = { very_high: 5, high: 4, mostly_factual: 3, mixed: 1, low: 0, unknown: 2 };

  const scored = articles.rows.map((a) => ({
    ...a,
    score: (ratingScores[a.factual_rating] || 2) + 2,
  }));
  scored.sort((a, b) => b.score - a.score);

  await query(
    `UPDATE story_clusters SET image_url = $2 WHERE id = $1`,
    [clusterId, scored[0].image_url]
  );
}

/**
 * Compute velocity-aware significance for a cluster.
 */
async function computeVelocity(client, clusterId, meta) {
  const staticScore = (meta.source_count * 2) + (meta.country_count * 3) + (meta.region_count * 5);

  const velocity = await client.query(
    `SELECT COUNT(*)::int AS recent_articles FROM articles WHERE cluster_id = $1 AND ingested_at > NOW() - INTERVAL '2 hours'`,
    [clusterId]
  );
  const velocityBonus = velocity.rows[0].recent_articles * 4;

  const prevVelocity = await client.query(
    `SELECT COUNT(*)::int AS prev_articles FROM articles WHERE cluster_id = $1 AND ingested_at > NOW() - INTERVAL '4 hours' AND ingested_at <= NOW() - INTERVAL '2 hours'`,
    [clusterId]
  );

  const currentRate = velocity.rows[0].recent_articles;
  const previousRate = prevVelocity.rows[0].prev_articles;
  const accelerationBonus = currentRate > previousRate ? (currentRate - previousRate) * 3 : 0;

  const lastArticle = await client.query(
    `SELECT MAX(ingested_at) AS latest FROM articles WHERE cluster_id = $1`,
    [clusterId]
  );

  const hoursSinceLastArticle = lastArticle.rows[0].latest
    ? (Date.now() - new Date(lastArticle.rows[0].latest).getTime()) / 3600000
    : 0;
  const decayFactor = Math.pow(0.95, hoursSinceLastArticle);

  const finalSignificance = Math.round(((staticScore + velocityBonus + accelerationBonus) * decayFactor) * 100) / 100;

  return {
    significance: finalSignificance,
    velocity: currentRate,
    acceleration: currentRate - previousRate,
    hours_since_update: Math.round(hoursSinceLastArticle * 10) / 10,
  };
}

/**
 * Add articles to an existing cluster and update metadata.
 * @param {string} clusterId
 * @param {string[]} articleIds
 */
export async function addToCluster(clusterId, articleIds) {
  await transaction(async (client) => {
    await client.query(
      `UPDATE articles SET cluster_id = $1 WHERE id = ANY($2)`,
      [clusterId, articleIds]
    );

    const meta = await client.query(
      `SELECT
        COUNT(DISTINCT a.source_id)::int AS source_count,
        COUNT(DISTINCT s.country_code)::int AS country_count,
        COUNT(DISTINCT s.region)::int AS region_count,
        json_agg(DISTINCT s.region) AS regions,
        json_agg(DISTINCT s.country_code) AS countries
       FROM articles a
       JOIN sources s ON s.id = a.source_id
       WHERE a.cluster_id = $1`,
      [clusterId]
    );

    const m = meta.rows[0];
    const velocityData = await computeVelocity(client, clusterId, m);

    await client.query(
      `UPDATE story_clusters SET
        source_count = $2, country_count = $3, region_count = $4,
        significance = $5, regions = $6, countries = $7, last_updated = NOW(),
        velocity = $8, acceleration = $9, hours_since_update = $10
       WHERE id = $1`,
      [clusterId, m.source_count, m.country_count, m.region_count,
       velocityData.significance, JSON.stringify(m.regions), JSON.stringify(m.countries),
       velocityData.velocity, velocityData.acceleration, velocityData.hours_since_update]
    );
  });

  // Update image selection
  selectClusterImage(clusterId).catch(() => {});
}

/**
 * Get paginated story clusters sorted by significance.
 * @param {object} opts
 * @returns {Promise<{ clusters: object[], total: number }>}
 */
export async function getStoryClusters({ topic, search, limit = 20, offset = 0, include_archived = false }) {
  const conditions = include_archived ? [] : ['sc.is_active = true'];
  const params = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(sc.canonical_title ILIKE $${paramIdx} OR sc.summary ILIKE $${paramIdx} OR sc.topic ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (topic) {
    conditions.push(`sc.topic = $${paramIdx++}`);
    params.push(topic);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)::int FROM story_clusters sc ${where}`,
    params
  );

  const result = await query(
    `SELECT sc.*,
       (SELECT COUNT(*)::int FROM articles WHERE cluster_id = sc.id) AS article_count
     FROM story_clusters sc
     ${where}
     ORDER BY sc.significance DESC, sc.last_updated DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { clusters: result.rows, total: countResult.rows[0].count };
}

/**
 * Get a single cluster with all member articles grouped by region.
 * @param {string} clusterId
 * @returns {Promise<object|null>}
 */
export async function getClusterWithArticles(clusterId) {
  const clusterResult = await query(
    `SELECT * FROM story_clusters WHERE id = $1`,
    [clusterId]
  );
  if (clusterResult.rows.length === 0) return null;

  const cluster = clusterResult.rows[0];

  const articlesResult = await query(
    `SELECT a.id, COALESCE(a.translated_title, a.title) AS title, a.title AS original_title,
            a.summary, a.url, a.image_url, a.author,
            a.language, a.topic, a.published_at,
            json_build_object(
              'id', s.id, 'name', s.name, 'slug', s.slug, 'url', s.url,
              'country_code', s.country_code, 'region', s.region,
              'funding_model', s.funding_model, 'editorial_lean', s.editorial_lean,
              'factual_rating', s.factual_rating, 'ownership', s.ownership
            ) AS source
     FROM articles a
     JOIN sources s ON s.id = a.source_id
     WHERE a.cluster_id = $1
     ORDER BY a.published_at DESC`,
    [clusterId]
  );

  // Group articles by region
  const byRegion = {};
  for (const article of articlesResult.rows) {
    const region = article.source.region;
    if (!byRegion[region]) byRegion[region] = [];
    byRegion[region].push(article);
  }

  return { ...cluster, articles: articlesResult.rows, articles_by_region: byRegion };
}

/**
 * Get clusters that need topic classification.
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function getClustersNeedingTopics(limit = 20) {
  const result = await query(
    `SELECT sc.id, sc.canonical_title,
       (SELECT json_agg(json_build_object('title', a.title, 'body_text', LEFT(a.body_text, 300)))
        FROM (SELECT title, body_text FROM articles WHERE cluster_id = sc.id LIMIT 5) a
       ) AS sample_articles
     FROM story_clusters sc
     WHERE sc.topic IS NULL AND sc.is_active = true
     ORDER BY sc.significance DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get clusters that need framing analysis.
 * Lowered threshold: 2+ sources with different regions, countries, or editorial leans.
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function getClustersNeedingFraming(limit = 10) {
  const result = await query(
    `SELECT sc.id, sc.canonical_title, sc.source_count, sc.region_count, sc.country_count,
       (SELECT json_agg(json_build_object(
          'title', a.title,
          'body_text', LEFT(a.body_text, 500),
          'source_name', s.name,
          'region', s.region,
          'country_code', s.country_code,
          'editorial_lean', s.editorial_lean
        ))
        FROM (SELECT * FROM articles WHERE cluster_id = sc.id ORDER BY published_at DESC LIMIT 8) a
        JOIN sources s ON s.id = a.source_id
       ) AS articles,
       (SELECT COUNT(DISTINCT s2.editorial_lean) FILTER (WHERE s2.editorial_lean IS NOT NULL AND s2.editorial_lean != 'unknown')
        FROM articles a2 JOIN sources s2 ON s2.id = a2.source_id
        WHERE a2.cluster_id = sc.id
       ) AS distinct_leans
     FROM story_clusters sc
     WHERE sc.source_count >= 2
       AND sc.summary IS NULL
       AND sc.is_active = true
       AND (
         (sc.source_count >= 3 AND sc.region_count >= 2)
         OR sc.region_count >= 2
         OR sc.country_count >= 2
         OR EXISTS (
           SELECT 1 FROM articles a3 JOIN sources s3 ON s3.id = a3.source_id
           WHERE a3.cluster_id = sc.id
           GROUP BY a3.cluster_id
           HAVING COUNT(DISTINCT s3.editorial_lean) FILTER (WHERE s3.editorial_lean IS NOT NULL AND s3.editorial_lean != 'unknown') >= 2
         )
       )
     ORDER BY sc.significance DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get clusters that need a canonical title.
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function getClustersNeedingTitles(limit = 20) {
  const result = await query(
    `SELECT sc.id,
       (SELECT json_agg(json_build_object('title', a.title, 'body_text', LEFT(a.body_text, 400)))
        FROM (SELECT title, body_text FROM articles WHERE cluster_id = sc.id ORDER BY published_at DESC LIMIT 5) a
       ) AS sample_articles
     FROM story_clusters sc
     WHERE sc.canonical_title IS NULL AND sc.is_active = true
     ORDER BY sc.significance DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Update only the canonical title of a cluster.
 * @param {string} clusterId
 * @param {string} title
 */
export async function updateClusterTitle(clusterId, title) {
  await query(
    `UPDATE story_clusters SET canonical_title = $2, last_updated = NOW() WHERE id = $1`,
    [clusterId, title]
  );
}

/**
 * Update cluster topic and propagate to member articles.
 * @param {string} clusterId
 * @param {string} topic
 * @param {string} subTopic
 */
export async function updateClusterTopic(clusterId, topic, subTopic, topics = []) {
  const topicsJson = JSON.stringify(topics);
  await transaction(async (client) => {
    await client.query(
      `UPDATE story_clusters SET topic = $2, sub_topic = $3, topics = $4 WHERE id = $1`,
      [clusterId, topic, subTopic, topicsJson]
    );
    await client.query(
      `UPDATE articles SET topic = $2, sub_topic = $3, topics = $4 WHERE cluster_id = $1`,
      [clusterId, topic, subTopic, topicsJson]
    );
  });
}

/**
 * Update cluster summary (framing analysis) and canonical title.
 * @param {string} clusterId
 * @param {string} summary
 * @param {string} canonicalTitle
 */
export async function updateClusterSummary(clusterId, summary, canonicalTitle, framingType = null) {
  await query(
    `UPDATE story_clusters SET summary = $2, canonical_title = $3, framing_type = $4, last_updated = NOW() WHERE id = $1`,
    [clusterId, summary, canonicalTitle, framingType]
  );
}
