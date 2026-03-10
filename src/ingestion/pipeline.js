import { getActiveSources, findByName, insertIngestionLog } from '../services/sourceRepo.js';
import { insertArticle } from '../services/articleRepo.js';
import { upsertPendingSource } from '../services/pendingSourceRepo.js';
import { fetchAllFeedsForSource } from './rss.js';
import { fetchAllNewsApis } from './newsApis.js';
import { normalizeArticle } from '../utils/normalizer.js';
import { parallelLimit } from '../utils/concurrency.js';
import { invalidateAll } from '../services/cache.js';
import logger from '../utils/logger.js';

const FEED_TIMEOUT = 30000; // 30s max per source

/**
 * Process articles from a single RSS source.
 * @param {object} source
 * @returns {Promise<{ sourceNew: number, sourceDuped: number, sourceErrors: number }>}
 */
async function processRssSource(source) {
  const { articles: rawArticles, feedResults } = await fetchAllFeedsForSource(source);

  let sourceNew = 0;
  let sourceDuped = 0;
  let sourceErrors = 0;

  for (const raw of rawArticles) {
    if (!raw.url) continue;
    try {
      const normalized = normalizeArticle(raw, source.id);
      if (!normalized.title || !normalized.url) continue;
      const inserted = await insertArticle(normalized);
      if (inserted) {
        sourceNew++;
      } else {
        sourceDuped++;
      }
    } catch (err) {
      sourceErrors++;
      logger.error('Article insert error', { url: raw.url, error: err.message });
    }
  }

  for (const fr of feedResults) {
    fr.articles_new = sourceNew;
    fr.articles_duped = sourceDuped;
    try {
      await insertIngestionLog(fr);
    } catch (err) {
      logger.error('Failed to log ingestion', { error: err.message });
    }
  }

  return { sourceNew, sourceDuped, sourceErrors };
}

/**
 * Wrap a promise with a timeout.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

/**
 * Run the full ingestion pipeline:
 * 1. Fetch RSS feeds for all active sources (parallel, concurrency 10)
 * 2. Fetch from news APIs in parallel
 * 3. Match API articles to known sources
 * 4. Normalize, dedup, insert
 * 5. Log results
 * @returns {Promise<{ totalNew: number, totalDuped: number, totalErrors: number }>}
 */
export async function runIngestionPipeline() {
  const pipelineStart = Date.now();
  logger.info('Ingestion pipeline started');

  const sources = await getActiveSources();
  if (sources.length === 0) {
    logger.warn('No active sources found');
    return { totalNew: 0, totalDuped: 0, totalErrors: 0 };
  }

  let totalNew = 0;
  let totalDuped = 0;
  let totalErrors = 0;

  // 1. Parallel RSS ingestion with concurrency limit of 10
  const sourcesWithFeeds = sources.filter((s) => s.rss_feeds && s.rss_feeds.length > 0);
  logger.info(`Starting parallel RSS ingestion`, { sourceCount: sourcesWithFeeds.length, concurrency: 10 });

  const rssStart = Date.now();
  const tasks = sourcesWithFeeds.map((source) => async () => {
    try {
      return await withTimeout(processRssSource(source), FEED_TIMEOUT, source.name);
    } catch (err) {
      logger.error(`RSS ingestion failed for ${source.name}`, { error: err.message });
      await insertIngestionLog({
        source_id: source.id,
        feed_url: source.rss_feeds[0] || 'unknown',
        status: 'failed',
        articles_found: 0,
        articles_new: 0,
        articles_duped: 0,
        error_message: err.message,
        started_at: new Date(rssStart),
        completed_at: new Date(),
        duration_ms: Date.now() - rssStart,
      }).catch(() => {});
      return { sourceNew: 0, sourceDuped: 0, sourceErrors: 1 };
    }
  });

  const rssResults = await parallelLimit(tasks, 10);
  const rssDuration = Date.now() - rssStart;

  for (const result of rssResults) {
    if (result.status === 'fulfilled') {
      totalNew += result.value.sourceNew;
      totalDuped += result.value.sourceDuped;
      totalErrors += result.value.sourceErrors || 0;
    }
  }

  logger.info(`RSS phase complete in ${rssDuration}ms (${sourcesWithFeeds.length} sources, concurrency: 10)`);

  // 2. News API ingestion
  logger.info('Starting News API ingestion');
  const apiStart = new Date();
  try {
    const apiArticles = await fetchAllNewsApis();
    let apiNew = 0;
    let apiDuped = 0;

    for (const raw of apiArticles) {
      if (!raw.url) continue;

      // Match to known source by name
      let sourceId = null;
      if (raw.source_name) {
        const matchedSource = await findByName(raw.source_name);
        if (matchedSource) {
          sourceId = matchedSource.id;
        }
      }

      // Capture unknown sources for review instead of silently discarding
      if (!sourceId) {
        if (raw.source_name) {
          try {
            await upsertPendingSource(
              raw.source_name,
              raw.url ? new URL(raw.url).origin : null,
              null,
              null,
              { title: raw.title, url: raw.url, published_at: raw.published_at }
            );
          } catch (err) {
            // Non-critical
          }
        }
        continue;
      }

      try {
        const normalized = normalizeArticle(raw, sourceId);
        if (!normalized.title || !normalized.url) continue;
        const inserted = await insertArticle(normalized);
        if (inserted) {
          apiNew++;
        } else {
          apiDuped++;
        }
      } catch (err) {
        totalErrors++;
        logger.error('API article insert error', { url: raw.url, error: err.message });
      }
    }

    totalNew += apiNew;
    totalDuped += apiDuped;

    await insertIngestionLog({
      source_id: null,
      feed_url: 'news-apis',
      status: 'success',
      articles_found: apiArticles.length,
      articles_new: apiNew,
      articles_duped: apiDuped,
      started_at: apiStart,
      completed_at: new Date(),
      duration_ms: Date.now() - apiStart.getTime(),
    });
  } catch (err) {
    totalErrors++;
    logger.error('News API ingestion failed', { error: err.message });
    await insertIngestionLog({
      source_id: null,
      feed_url: 'news-apis',
      status: 'failed',
      articles_found: 0,
      articles_new: 0,
      articles_duped: 0,
      error_message: err.message,
      started_at: apiStart,
      completed_at: new Date(),
      duration_ms: Date.now() - apiStart.getTime(),
    });
  }

  const duration = Date.now() - pipelineStart;
  logger.info('Ingestion pipeline complete', { totalNew, totalDuped, totalErrors, duration });

  // Invalidate API caches after new data arrives
  await invalidateAll();

  return { totalNew, totalDuped, totalErrors };
}
