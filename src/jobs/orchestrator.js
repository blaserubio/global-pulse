import { embeddingQueue } from './queues.js';
import logger from '../utils/logger.js';

/**
 * Kick off the intelligence pipeline as a BullMQ flow.
 *
 * Flow:
 *   Embedding → Clustering → (Translation + Classification + Titles) in parallel
 *   Classification completion → Framing → Cache invalidation
 *
 * Each worker triggers the next step on completion (see worker files).
 */
export async function startIntelligenceFlow() {
  logger.info('Starting intelligence flow via BullMQ');
  const job = await embeddingQueue.add('intelligence-pipeline', { batchSize: 50 });
  logger.info(`Intelligence flow queued: job ${job.id}`);
  return job.id;
}
