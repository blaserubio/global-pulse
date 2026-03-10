import { pipeline } from '@xenova/transformers';
import { query } from '../db/pool.js';
import logger from '../utils/logger.js';

let embedder = null;

/**
 * Initialize the multilingual sentence-transformers model (lazy singleton).
 * Using multilingual-e5-large for cross-language clustering support (1024 dims).
 * @returns {Promise<Function>}
 */
async function getEmbedder() {
  if (!embedder) {
    logger.info('Loading embedding model (multilingual-e5-large)...');
    embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-large');
    logger.info('Embedding model loaded');
  }
  return embedder;
}

/**
 * Generate a 1024-dim embedding for the given text.
 * Prepends "query: " prefix as required by the E5 model family.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(text) {
  const model = await getEmbedder();
  const output = await model(`query: ${text}`, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Get articles that need embeddings (no embedding yet, from last 48 hours).
 * Returns original language text for multilingual embedding.
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function getArticlesNeedingEmbeddings(limit = 50) {
  const result = await query(
    `SELECT id, title, body_text, original_title, original_body_text FROM articles
     WHERE embedding IS NULL
       AND ingested_at > NOW() - INTERVAL '48 hours'
     ORDER BY ingested_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Store an embedding vector for an article.
 * @param {string} articleId
 * @param {number[]} embedding
 */
export async function storeEmbedding(articleId, embedding) {
  const vectorStr = `[${embedding.join(',')}]`;
  await query(
    `UPDATE articles SET embedding = $1 WHERE id = $2`,
    [vectorStr, articleId]
  );
}

/**
 * Process a batch of articles: generate and store embeddings.
 * Embeds ORIGINAL language text for cross-language clustering.
 * @param {number} batchSize
 * @returns {Promise<number>} Number of articles processed
 */
export async function processEmbeddingBatch(batchSize = 50) {
  const articles = await getArticlesNeedingEmbeddings(batchSize);
  if (articles.length === 0) return 0;

  logger.info(`Generating embeddings for ${articles.length} articles`);
  let processed = 0;

  for (const article of articles) {
    try {
      // Use original language text for multilingual embedding
      const title = article.original_title || article.title;
      const body = article.original_body_text || article.body_text || '';
      const bodyWords = body.split(/\s+/).slice(0, 200).join(' ');
      const text = `${title} ${bodyWords}`.trim();
      if (!text) continue;

      const embedding = await generateEmbedding(text);
      await storeEmbedding(article.id, embedding);
      processed++;
    } catch (err) {
      logger.error('Embedding generation failed', { articleId: article.id, error: err.message });
    }
  }

  logger.info(`Embeddings generated for ${processed}/${articles.length} articles`);
  return processed;
}

/**
 * Process all pending articles in batches.
 * @returns {Promise<number>} Total articles processed
 */
export async function processAllPendingEmbeddings() {
  let total = 0;
  let batch;
  do {
    batch = await processEmbeddingBatch(50);
    total += batch;
  } while (batch > 0);
  return total;
}
