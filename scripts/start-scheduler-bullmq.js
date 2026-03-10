import { runIngestionPipeline } from '../src/ingestion/pipeline.js';
import { startIntelligenceFlow } from '../src/jobs/orchestrator.js';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';

let isRunning = false;

async function tick() {
  if (isRunning) {
    logger.warn('Skipping run — previous cycle still in progress');
    return;
  }

  isRunning = true;
  try {
    // 1. Ingest new articles
    const ingestionResult = await runIngestionPipeline();
    logger.info('Scheduled ingestion complete', ingestionResult);

    // 2. Kick off the intelligence pipeline via BullMQ
    // Workers handle: Embed → Cluster → (Translate + Classify + Titles) → Framing
    const jobId = await startIntelligenceFlow();
    logger.info(`Intelligence flow started: job ${jobId}`);
  } catch (err) {
    logger.error('Scheduled cycle failed', { error: err.message });
  } finally {
    isRunning = false;
  }
}

const intervalMs = config.ingestion.intervalMinutes * 60 * 1000;
logger.info(`BullMQ scheduler started — running every ${config.ingestion.intervalMinutes} minutes`);

tick();
setInterval(tick, intervalMs);
