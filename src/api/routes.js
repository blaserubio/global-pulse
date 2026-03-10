import { Router } from 'express';
import { z } from 'zod';
import { healthCheck } from '../db/pool.js';
import * as articleRepo from '../services/articleRepo.js';
import * as sourceRepo from '../services/sourceRepo.js';
import * as clusterRepo from '../services/clusterRepo.js';
import * as pendingSourceRepo from '../services/pendingSourceRepo.js';
import { runIngestionPipeline } from '../ingestion/pipeline.js';
import { runSourceDiscovery } from '../services/sourceDiscovery.js';
import { getPsychologyMap } from '../services/psychologyService.js';
import { cacheGet, cacheSet, invalidateAll } from '../services/cache.js';
import { requireAdminKey } from './middleware/adminAuth.js';
import { getCostSummary } from '../utils/apiCostTracker.js';
import logger from '../utils/logger.js';

const router = Router();

// --- Validation Schemas ---

const headlinesSchema = z.object({
  topic: z.string().optional(),
  region: z.enum(['americas', 'europe', 'asia_pacific', 'mideast_africa']).optional(),
  language: z.string().max(5).optional(),
  since: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const idSchema = z.object({
  id: z.string().uuid(),
});

const hoursSchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(24),
});

const storiesSchema = z.object({
  topic: z.string().optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  include_archived: z.coerce.boolean().default(false),
});

// --- Middleware ---

function validate(schema, source = 'query') {
  return (req, res, next) => {
    const result = schema.safeParse(source === 'params' ? req.params : req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues,
      });
    }
    req.validated = result.data;
    next();
  };
}

function cached(ttl = 900) {
  return async (req, res, next) => {
    // Use path + sorted known params only (not raw URL) to prevent cache flooding
    const sortedParams = Object.keys(req.query).sort().map(k => `${k}=${req.query[k]}`).join('&');
    const key = `api:${req.path}?${sortedParams}`;
    const hit = await cacheGet(key);
    if (hit) {
      res.set('X-Cache', 'HIT');
      return res.json(hit);
    }
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      cacheSet(key, body, ttl).catch(() => {});
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };
    next();
  };
}

// --- Routes ---

router.get('/health', async (_req, res) => {
  const dbOk = await healthCheck();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'healthy' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

router.get('/headlines', cached(900), validate(headlinesSchema), async (req, res) => {
  try {
    const { articles, total } = await articleRepo.getHeadlines(req.validated);
    res.json({ articles, total, limit: req.validated.limit, offset: req.validated.offset });
  } catch (err) {
    logger.error('Headlines error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch headlines' });
  }
});

router.get('/articles/:id', validate(idSchema, 'params'), async (req, res) => {
  try {
    const article = await articleRepo.getArticleById(req.validated.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    logger.error('Article fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

router.get('/sources', cached(3600), async (_req, res) => {
  try {
    const sources = await sourceRepo.getSourcesWithStats();
    res.json({ sources });
  } catch (err) {
    logger.error('Sources error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

router.get('/stats/topics', validate(hoursSchema), async (req, res) => {
  try {
    const topics = await articleRepo.getTopicStats(req.validated.hours);
    res.json({ topics, hours: req.validated.hours });
  } catch (err) {
    logger.error('Topic stats error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch topic stats' });
  }
});

router.get('/stats/regions', validate(hoursSchema), async (req, res) => {
  try {
    const regions = await articleRepo.getRegionStats(req.validated.hours);
    res.json({ regions, hours: req.validated.hours });
  } catch (err) {
    logger.error('Region stats error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch region stats' });
  }
});

router.get('/stats/overview', cached(900), async (_req, res) => {
  try {
    const stats = await articleRepo.getOverviewStats();
    res.json(stats);
  } catch (err) {
    logger.error('Overview stats error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch overview stats' });
  }
});

// --- Story Cluster Routes ---

router.get('/stories', cached(900), validate(storiesSchema), async (req, res) => {
  try {
    const { clusters, total } = await clusterRepo.getStoryClusters(req.validated);
    res.json({ stories: clusters, total, limit: req.validated.limit, offset: req.validated.offset });
  } catch (err) {
    logger.error('Stories error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

router.get('/stories/:id', validate(idSchema, 'params'), async (req, res) => {
  try {
    const cluster = await clusterRepo.getClusterWithArticles(req.validated.id);
    if (!cluster) return res.status(404).json({ error: 'Story not found' });
    res.json(cluster);
  } catch (err) {
    logger.error('Story detail error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

router.get('/stories/:id/framing', validate(idSchema, 'params'), async (req, res) => {
  try {
    const cluster = await clusterRepo.getClusterWithArticles(req.validated.id);
    if (!cluster) return res.status(404).json({ error: 'Story not found' });
    if (!cluster.summary) {
      return res.json({
        story_id: cluster.id,
        framing_analysis: null,
        message: 'Framing analysis not yet available for this story',
        ai_generated: true,
      });
    }
    res.json({
      story_id: cluster.id,
      canonical_title: cluster.canonical_title,
      framing_analysis: cluster.summary,
      source_count: cluster.source_count,
      region_count: cluster.region_count,
      regions: cluster.regions,
      ai_generated: true,
    });
  } catch (err) {
    logger.error('Framing error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch framing analysis' });
  }
});

// --- Psychology Map ---

router.get('/psychology-map', cached(1800), async (_req, res) => {
  try {
    const result = await getPsychologyMap();
    res.json(result);
  } catch (err) {
    logger.error('Psychology map error', { error: err.message });
    res.status(500).json({ error: 'Failed to generate psychology map' });
  }
});

router.post('/admin/ingest', requireAdminKey, async (_req, res) => {
  // Fire and forget — return immediately
  res.json({ status: 'started', message: 'Ingestion pipeline triggered' });
  try {
    await runIngestionPipeline();
  } catch (err) {
    logger.error('Manual ingestion failed', { error: err.message });
  }
});

// --- Pending Sources Admin Routes ---

const pendingSourcesSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'ignored']).optional(),
  min_seen: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/admin/pending-sources', requireAdminKey, validate(pendingSourcesSchema), async (req, res) => {
  try {
    const result = await pendingSourceRepo.getPendingSources({
      status: req.validated.status,
      minTimesSeen: req.validated.min_seen,
      limit: req.validated.limit,
      offset: req.validated.offset,
    });
    res.json(result);
  } catch (err) {
    logger.error('Pending sources error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pending sources' });
  }
});

const reviewBodySchema = z.object({
  status: z.enum(['approved', 'rejected', 'ignored']),
});

router.post('/admin/pending-sources/:id/review', requireAdminKey, validate(idSchema, 'params'), async (req, res) => {
  try {
    const bodyResult = reviewBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ error: 'Status must be approved, rejected, or ignored' });
    }
    const source = await pendingSourceRepo.reviewSource(req.validated.id, bodyResult.data.status);
    if (!source) return res.status(404).json({ error: 'Pending source not found' });
    res.json(source);
  } catch (err) {
    logger.error('Review source error', { error: err.message });
    res.status(500).json({ error: 'Failed to review source' });
  }
});

const promoteBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100),
  url: z.string().url(),
  country_code: z.string().length(2),
  region: z.enum(['americas', 'europe', 'asia_pacific', 'mideast_africa']),
  rss_feeds: z.array(z.string().url()).min(1),
  funding_model: z.enum(['state_funded', 'public', 'private', 'nonprofit', 'unknown']).default('unknown'),
  editorial_lean: z.enum(['left', 'center_left', 'center', 'center_right', 'right', 'unknown']).default('unknown'),
  factual_rating: z.enum(['very_high', 'high', 'mostly_factual', 'mixed', 'low', 'unknown']).default('unknown'),
  ownership: z.string().max(500).default('Unknown'),
});

router.post('/admin/pending-sources/:id/promote', requireAdminKey, validate(idSchema, 'params'), async (req, res) => {
  try {
    const bodyResult = promoteBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: bodyResult.error.issues });
    }
    const source = await pendingSourceRepo.promoteSource(req.validated.id, bodyResult.data);
    if (!source) return res.status(404).json({ error: 'Pending source not found' });
    res.json({ message: 'Source promoted to active', source });
  } catch (err) {
    logger.error('Promote source error', { error: err.message });
    res.status(500).json({ error: 'Failed to promote source' });
  }
});

router.post('/admin/discover-sources', requireAdminKey, async (_req, res) => {
  res.json({ status: 'started', message: 'Source discovery triggered' });
  try {
    await runSourceDiscovery();
  } catch (err) {
    logger.error('Source discovery failed', { error: err.message });
  }
});

router.get('/admin/costs', requireAdminKey, validate(hoursSchema), async (req, res) => {
  try {
    const hours = req.validated.hours;
    const summary = await getCostSummary(hours);
    res.json({ summary, period_hours: hours });
  } catch (err) {
    logger.error('Cost summary error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

export default router;
