import logger from '../utils/logger.js';

// BullMQ is not used for job processing (scheduler runs pipelines directly).
// Only initialize if explicitly needed (e.g., BullMQ workers mode).
// This prevents Redis connection errors from crashing the API server.

let embeddingQueue, clusteringQueue, translationQueue,
    classificationQueue, titleQueue, framingQueue,
    flowProducer;
let ALL_QUEUES = [];

export async function initQueues() {
  try {
    const { Queue, FlowProducer } = await import('bullmq');
    const config = (await import('../config/index.js')).default;
    const connection = { url: config.redis.url };

    embeddingQueue = new Queue('embedding', { connection });
    clusteringQueue = new Queue('clustering', { connection });
    translationQueue = new Queue('translation', { connection });
    classificationQueue = new Queue('classification', { connection });
    titleQueue = new Queue('title-generation', { connection });
    framingQueue = new Queue('framing-analysis', { connection });

    flowProducer = new FlowProducer({ connection });

    ALL_QUEUES = [
      embeddingQueue,
      clusteringQueue,
      translationQueue,
      classificationQueue,
      titleQueue,
      framingQueue,
    ];

    logger.info('BullMQ queues initialized');
    return true;
  } catch (err) {
    logger.warn('BullMQ queues not available', { error: err.message });
    return false;
  }
}

export {
  embeddingQueue,
  clusteringQueue,
  translationQueue,
  classificationQueue,
  titleQueue,
  framingQueue,
  flowProducer,
  ALL_QUEUES,
};
