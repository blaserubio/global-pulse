import { runIngestionPipeline } from '../src/ingestion/pipeline.js';
import logger from '../src/utils/logger.js';

logger.info('Manual ingestion run starting');

runIngestionPipeline()
  .then((result) => {
    logger.info('Ingestion complete', result);
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Ingestion failed', { error: err.message });
    process.exit(1);
  });
