import { Queue, FlowProducer } from 'bullmq';
import config from '../config/index.js';
import logger from '../utils/logger.js';

let embeddingQueue, clusteringQueue, translationQueue,
    classificationQueue, titleQueue, framingQueue,
    flowProducer;
let ALL_QUEUES = [];

try {
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
} catch (err) {
  logger.warn('BullMQ queues not available — job dashboard disabled', { error: err.message });
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
