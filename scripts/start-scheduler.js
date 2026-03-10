import * as Sentry from '@sentry/node';
import { runIngestionPipeline } from '../src/ingestion/pipeline.js';
import { processAllPendingEmbeddings } from '../src/services/embeddingService.js';
import { runClustering } from '../src/services/clusteringService.js';
import { classifyAllPendingTopics, titleAllPendingClusters, analyzeAllPendingFraming } from '../src/services/classificationService.js';
import { translateAllPending } from '../src/services/translationService.js';
import { invalidateAll } from '../src/services/cache.js';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';

// Initialize Sentry for scheduler process
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
  logger.info('Sentry initialized for scheduler');
}

let isRunning = false;

async function runPhase(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    logger.info(`Phase "${name}" complete`, { result, durationMs });
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error(`Phase "${name}" failed — continuing to next phase`, {
      error: err.message,
      durationMs,
    });
    if (config.sentryDsn) {
      Sentry.captureException(err, { tags: { phase: name } });
    }
    return null;
  }
}

async function tick() {
  if (isRunning) {
    logger.warn('Skipping run — previous cycle still in progress');
    return;
  }

  isRunning = true;
  const cycleStart = Date.now();

  try {
    // 1. Ingest new articles
    await runPhase('ingest', () => runIngestionPipeline());

    // 2. Generate embeddings on original language text
    await runPhase('embed', () => processAllPendingEmbeddings());

    // 3. Run clustering
    await runPhase('cluster', () => runClustering(config.clustering.similarityThreshold));

    // 4. Translate non-English articles (after clustering)
    await runPhase('translate', () => translateAllPending());

    // 5. Classify topics
    await runPhase('classify', () => classifyAllPendingTopics());

    // 6. Generate titles for untitled clusters
    await runPhase('title', () => titleAllPendingClusters());

    // 7. Generate framing analysis
    await runPhase('framing', () => analyzeAllPendingFraming());

    // Invalidate API caches
    await invalidateAll();

    const totalMs = Date.now() - cycleStart;
    logger.info(`Full pipeline cycle complete`, { durationMs: totalMs });
  } catch (err) {
    logger.error('Scheduled cycle failed critically', { error: err.message });
    if (config.sentryDsn) {
      Sentry.captureException(err);
    }
  } finally {
    isRunning = false;
  }
}

const intervalMs = config.ingestion.intervalMinutes * 60 * 1000;
logger.info(`Scheduler started — running every ${config.ingestion.intervalMinutes} minutes`);

// Run immediately on start, then on interval
tick();
setInterval(tick, intervalMs);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down scheduler');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down scheduler');
  process.exit(0);
});
