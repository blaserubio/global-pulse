import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { titleAllPendingClusters } from '../../services/classificationService.js';
import logger from '../../utils/logger.js';

const connection = { url: config.redis.url };

export const titleWorker = new Worker('title-generation', async (job) => {
  logger.info('Title generation job started');
  let total = 0;
  let batch;
  do {
    batch = await titleAllPendingClusters();
    total += batch;
  } while (batch > 0);
  logger.info(`Title generation job complete: ${total} clusters`);
  return { titled: total };
}, {
  connection,
  concurrency: 1,
  limiter: { max: 5, duration: 1000 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

titleWorker.on('failed', (job, err) => {
  logger.error('Title generation job failed', { jobId: job?.id, error: err.message });
});
