import { Worker } from 'bullmq';
import config from '../../config/index.js';
import { classifyAllPendingTopics } from '../../services/classificationService.js';
import { framingQueue } from '../queues.js';
import logger from '../../utils/logger.js';

const connection = { url: config.redis.url };

export const classificationWorker = new Worker('classification', async (job) => {
  logger.info('Classification job started');
  let total = 0;
  let batch;
  do {
    batch = await classifyAllPendingTopics();
    total += batch;
  } while (batch > 0);
  logger.info(`Classification job complete: ${total} clusters`);

  // Trigger framing analysis after classification is done
  await framingQueue.add('framing-after-classification', {});

  return { classified: total };
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

classificationWorker.on('failed', (job, err) => {
  logger.error('Classification job failed', { jobId: job?.id, error: err.message });
});
