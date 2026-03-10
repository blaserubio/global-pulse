import '../src/jobs/workers/embeddingWorker.js';
import '../src/jobs/workers/clusteringWorker.js';
import '../src/jobs/workers/translationWorker.js';
import '../src/jobs/workers/classificationWorker.js';
import '../src/jobs/workers/titleWorker.js';
import '../src/jobs/workers/framingWorker.js';
import logger from '../src/utils/logger.js';

logger.info('All BullMQ workers started and listening for jobs');

// Keep process alive
process.on('SIGINT', () => {
  logger.info('Shutting down workers...');
  process.exit(0);
});
