import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { translateAllPending } from '../../services/translationService.js';
import logger from '../../utils/logger.js';

const connection = { url: config.redis.url };

export const translationWorker = new Worker('translation', async (job) => {
  logger.info('Translation job started');
  let total = 0;
  let batch;
  do {
    batch = await translateAllPending();
    total += batch;
  } while (batch > 0);
  logger.info(`Translation job complete: ${total} articles`);
  return { translated: total };
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

translationWorker.on('failed', (job, err) => {
  logger.error('Translation job failed', { jobId: job?.id, error: err.message });
});
