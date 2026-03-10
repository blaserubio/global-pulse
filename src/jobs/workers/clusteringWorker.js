import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { runClustering } from '../../services/clusteringService.js';
import { translationQueue, classificationQueue, titleQueue } from '../queues.js';
import logger from '../../utils/logger.js';

const connection = { url: config.redis.url };

export const clusteringWorker = new Worker('clustering', async (job) => {
  logger.info('Clustering job started');
  const result = await runClustering(config.clustering.similarityThreshold);
  logger.info('Clustering job complete', result);

  // Chain: trigger translation, classification, and title generation in parallel
  await Promise.all([
    translationQueue.add('translation-after-clustering', {}),
    classificationQueue.add('classification-after-clustering', {}),
    titleQueue.add('titles-after-clustering', {}),
  ]);

  return result;
}, {
  connection,
  concurrency: 1,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

clusteringWorker.on('failed', (job, err) => {
  logger.error('Clustering job failed', { jobId: job?.id, error: err.message });
});
