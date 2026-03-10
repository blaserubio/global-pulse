import { processAllPendingEmbeddings } from '../src/services/embeddingService.js';
import { runClustering } from '../src/services/clusteringService.js';
import { classifyAllPendingTopics, titleAllPendingClusters, analyzeAllPendingFraming } from '../src/services/classificationService.js';
import { translateAllPending } from '../src/services/translationService.js';
import { invalidateAll } from '../src/services/cache.js';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';

async function runIntelligencePipeline() {
  const start = Date.now();
  logger.info('Intelligence pipeline started');

  // 1. Generate embeddings on ORIGINAL language text (multilingual model)
  logger.info('Phase: Embedding generation');
  const embedded = await processAllPendingEmbeddings();
  logger.info(`Embeddings complete: ${embedded} articles processed`);

  // 2. Run clustering (works across languages thanks to multilingual embeddings)
  logger.info('Phase: Story clustering');
  const clusterResult = await runClustering(config.clustering.similarityThreshold);
  logger.info('Clustering complete', clusterResult);

  // 3. Translate non-English articles (for display, after clustering)
  logger.info('Phase: Translation');
  const translated = await translateAllPending();
  logger.info(`Translation complete: ${translated} articles translated`);

  // 4. Classify topics (requires Claude API key)
  logger.info('Phase: Topic classification');
  const classified = await classifyAllPendingTopics();
  logger.info(`Topic classification complete: ${classified} clusters classified`);

  // 5. Generate canonical titles for all clusters
  logger.info('Phase: Title generation');
  const titled = await titleAllPendingClusters();
  logger.info(`Title generation complete: ${titled} clusters titled`);

  // 6. Generate framing analysis (requires Claude API key)
  logger.info('Phase: Framing analysis');
  const analyzed = await analyzeAllPendingFraming();
  logger.info(`Framing analysis complete: ${analyzed} clusters analyzed`);

  // Invalidate API caches
  await invalidateAll();

  const duration = Date.now() - start;
  logger.info('Intelligence pipeline complete', { embedded, ...clusterResult, translated, classified, titled, analyzed, duration });
}

runIntelligencePipeline()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Intelligence pipeline failed', { error: err.message, stack: err.stack });
    process.exit(1);
  });
