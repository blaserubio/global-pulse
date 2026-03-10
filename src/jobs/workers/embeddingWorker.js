import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { processAllPendingEmbeddings } from '../../services/embeddingService.js';
import { clusteringQueue } from '../queues.js';
import logger from '../../utils/logger.js';

const connection = { url: config.redis.url };

export const embeddingWorker = new Worker('embedding', async (job) => {
  logger.info('Embedding job started');
  const total = await processAllPendingEmbeddings();
  logger.info(`Embedding job complete: ${total} articles`);

  // Chain: trigger clustering after embeddings
  await clusteringQueue.add('clustering-after-embedding', {});

  return { embedded: total };
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

embeddingWorker.on('failed', (job, err) => {
  logger.error('Embedding job failed', { jobId: job?.id, error: err.message });
});
