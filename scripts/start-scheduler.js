import { runIngestionPipeline } from '../src/ingestion/pipeline.js';
import { processAllPendingEmbeddings } from '../src/services/embeddingService.js';
import { runClustering } from '../src/services/clusteringService.js';
import { classifyAllPendingTopics, titleAllPendingClusters, analyzeAllPendingFraming } from '../src/services/classificationService.js';
import { translateAllPending } from '../src/services/translationService.js';
import { invalidateAll } from '../src/services/cache.js';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';

let isRunning = false;

async function tick() {
  if (isRunning) {
    logger.warn('Skipping run — previous cycle still in progress');
    return;
  }

  isRunning = true;
  try {
    // 1. Ingest new articles
    const ingestionResult = await runIngestionPipeline();
    logger.info('Scheduled ingestion complete', ingestionResult);

    // 2. Generate embeddings on original language text
    const embedded = await processAllPendingEmbeddings();
    logger.info(`Embeddings generated: ${embedded}`);

    // 3. Run clustering
    const clusterResult = await runClustering(config.clustering.similarityThreshold);
    logger.info('Clustering complete', clusterResult);

    // 4. Translate non-English articles (after clustering)
    const translated = await translateAllPending();
    logger.info(`Articles translated: ${translated}`);

    // 5. Classify topics
    const classified = await classifyAllPendingTopics();
    logger.info(`Topics classified: ${classified}`);

    // 6. Generate titles for untitled clusters
    const titled = await titleAllPendingClusters();
    logger.info(`Titles generated: ${titled}`);

    // 7. Generate framing analysis
    const analyzed = await analyzeAllPendingFraming();
    logger.info(`Framing analyses generated: ${analyzed}`);

    // Invalidate API caches
    await invalidateAll();
  } catch (err) {
    logger.error('Scheduled cycle failed', { error: err.message });
  } finally {
    isRunning = false;
  }
}

const intervalMs = config.ingestion.intervalMinutes * 60 * 1000;
logger.info(`Scheduler started — running every ${config.ingestion.intervalMinutes} minutes`);

// Run immediately on start, then on interval
tick();
setInterval(tick, intervalMs);
