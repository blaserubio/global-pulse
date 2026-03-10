import { Queue, FlowProducer } from 'bullmq';
import config from '../config/index.js';

const connection = { url: config.redis.url };

export const embeddingQueue = new Queue('embedding', { connection });
export const clusteringQueue = new Queue('clustering', { connection });
export const translationQueue = new Queue('translation', { connection });
export const classificationQueue = new Queue('classification', { connection });
export const titleQueue = new Queue('title-generation', { connection });
export const framingQueue = new Queue('framing-analysis', { connection });

export const flowProducer = new FlowProducer({ connection });

export const ALL_QUEUES = [
  embeddingQueue,
  clusteringQueue,
  translationQueue,
  classificationQueue,
  titleQueue,
  framingQueue,
];
