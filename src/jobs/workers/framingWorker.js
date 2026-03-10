import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { analyzeAllPendingFraming } from '../../services/classificationService.js';
import { invalidateAll } from '../../services/cache.js';
import logger from '../../utils/logger.js';

const connection = { url: config.redis.url };

export const framingWorker = new Worker('framing-analysis', async (job) => {
  logger.info('Framing analysis job started');
  let total = 0;
  let batch;
  do {
    batch = await analyzeAllPendingFraming();
    total += batch;
  } while (batch > 0);
  logger.info(`Framing analysis job complete: ${total} clusters`);

  // Invalidate caches after the final pipeline step
  await invalidateAll();

  return { analyzed: total };
}, {
  connection,
  concurrency: 1,
  limiter: { max: 3, duration: 1000 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

framingWorker.on('failed', (job, err) => {
  logger.error('Framing analysis job failed', { jobId: job?.id, error: err.message });
});
