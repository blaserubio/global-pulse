import { query } from '../db/pool.js';
import * as clusterRepo from './clusterRepo.js';
import logger from '../utils/logger.js';

/**
 * Run the clustering algorithm on unclustered articles.
 * Uses a connected-components approach with pgvector nearest-neighbor search.
 * Includes a second pass to catch same-batch articles that missed each other.
 * @param {number} similarityThreshold - Cosine similarity threshold (default 0.90)
 * @returns {Promise<{ clustersCreated: number, clustersUpdated: number, articlesAssigned: number }>}
 */
export async function runClustering(similarityThreshold = 0.90) {
  const maxDistance = 1 - similarityThreshold;
  logger.info('Starting clustering', { similarityThreshold, maxDistance });

  const unclustered = await clusterRepo.getUnclusteredArticles();
  if (unclustered.length === 0) {
    logger.info('No unclustered articles found');
    return { clustersCreated: 0, clustersUpdated: 0, articlesAssigned: 0 };
  }

  logger.info(`Found ${unclustered.length} unclustered articles`);

  // Build adjacency list using nearest neighbor search
  const adjacency = new Map();
  const processed = new Set();

  for (const article of unclustered) {
    if (processed.has(article.id)) continue;

    const neighbors = await clusterRepo.findNearestNeighbors(article.id, 20, maxDistance);

    if (neighbors.length > 0) {
      if (!adjacency.has(article.id)) adjacency.set(article.id, new Set());
      for (const neighbor of neighbors) {
        adjacency.get(article.id).add(neighbor.id);
        if (!adjacency.has(neighbor.id)) adjacency.set(neighbor.id, new Set());
        adjacency.get(neighbor.id).add(article.id);
      }
    }
    processed.add(article.id);
  }

  // Find connected components via BFS
  const visited = new Set();
  const components = [];

  for (const articleId of adjacency.keys()) {
    if (visited.has(articleId)) continue;

    const component = [];
    const queue = [articleId];
    visited.add(articleId);

    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      const neighbors = adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (component.length >= 2) {
      components.push(component);
    }
  }

  logger.info(`Found ${components.length} clusters from connected components`);

  let clustersCreated = 0;
  let clustersUpdated = 0;
  let articlesAssigned = 0;

  for (const component of components) {
    const existingClusterResult = await query(
      `SELECT DISTINCT cluster_id FROM articles
       WHERE id = ANY($1) AND cluster_id IS NOT NULL
       LIMIT 1`,
      [component]
    );

    if (existingClusterResult.rows.length > 0) {
      const clusterId = existingClusterResult.rows[0].cluster_id;
      const newArticles = [];
      for (const id of component) {
        const check = await query(`SELECT cluster_id FROM articles WHERE id = $1`, [id]);
        if (!check.rows[0].cluster_id) newArticles.push(id);
      }
      if (newArticles.length > 0) {
        await clusterRepo.addToCluster(clusterId, newArticles);
        articlesAssigned += newArticles.length;
        clustersUpdated++;
      }
    } else {
      const cluster = await clusterRepo.createCluster(component);
      articlesAssigned += component.length;
      clustersCreated++;
      logger.debug('Created cluster', {
        clusterId: cluster.id,
        articles: component.length,
        sources: cluster.source_count,
        regions: cluster.region_count,
      });
    }
  }

  // SECOND PASS: sweep remaining unclustered articles against each other
  const secondPassResult = await secondPassClustering(maxDistance);
  clustersCreated += secondPassResult.clustersCreated;
  articlesAssigned += secondPassResult.articlesAssigned;

  // Log singleton count
  const singletonResult = await query(
    `SELECT COUNT(*)::int AS count FROM articles
     WHERE cluster_id IS NULL AND embedding IS NOT NULL
     AND ingested_at > NOW() - INTERVAL '6 hours'`
  );
  const singletonCount = singletonResult.rows[0].count;
  const recentTotal = await query(
    `SELECT COUNT(*)::int AS count FROM articles
     WHERE embedding IS NOT NULL AND ingested_at > NOW() - INTERVAL '6 hours'`
  );
  const ratio = recentTotal.rows[0].count > 0
    ? (singletonCount / recentTotal.rows[0].count * 100).toFixed(1)
    : 0;

  if (ratio > 60) {
    logger.warn(`High singleton ratio: ${singletonCount} of ${recentTotal.rows[0].count} recent articles (${ratio}%) remain unclustered — consider lowering similarity threshold`);
  } else {
    logger.info(`${singletonCount} recent articles remain unclustered (${ratio}%)`);
  }

  // Archive stale clusters
  await archiveStaleClusters();

  logger.info('Clustering complete', { clustersCreated, clustersUpdated, articlesAssigned });
  return { clustersCreated, clustersUpdated, articlesAssigned };
}

/**
 * Second pass: find unclustered articles that are similar to each other
 * using union-find to build connected components.
 */
async function secondPassClustering(maxDistance) {
  const remaining = await query(
    `SELECT id FROM articles
     WHERE cluster_id IS NULL AND embedding IS NOT NULL
     AND ingested_at > NOW() - INTERVAL '48 hours'`
  );

  if (remaining.rows.length < 2) return { clustersCreated: 0, articlesAssigned: 0 };

  const ids = remaining.rows.map((r) => r.id);

  // Union-Find data structure
  const parent = new Map();
  const rank = new Map();

  function find(x) {
    if (!parent.has(x)) { parent.set(x, x); rank.set(x, 0); }
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rank.get(ra) < rank.get(rb)) { parent.set(ra, rb); }
    else if (rank.get(ra) > rank.get(rb)) { parent.set(rb, ra); }
    else { parent.set(rb, ra); rank.set(ra, rank.get(ra) + 1); }
  }

  // For each unclustered article, find nearest unclustered neighbors
  for (const id of ids) {
    const neighbors = await query(
      `SELECT a.id, a.embedding <=> (SELECT embedding FROM articles WHERE id = $1) AS distance
       FROM articles a
       WHERE a.cluster_id IS NULL AND a.embedding IS NOT NULL
         AND a.id != $1
         AND a.ingested_at > NOW() - INTERVAL '48 hours'
       ORDER BY a.embedding <=> (SELECT embedding FROM articles WHERE id = $1)
       LIMIT 10`,
      [id]
    );

    for (const neighbor of neighbors.rows) {
      if (neighbor.distance <= maxDistance) {
        union(id, neighbor.id);
      }
    }
  }

  // Group by connected component
  const groups = new Map();
  for (const id of ids) {
    if (!parent.has(id)) continue;
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }

  let clustersCreated = 0;
  let articlesAssigned = 0;

  for (const [, members] of groups) {
    if (members.length < 2) continue;

    // Verify they're still unclustered (another pass may have claimed them)
    const stillUnclustered = await query(
      `SELECT id FROM articles WHERE id = ANY($1) AND cluster_id IS NULL`,
      [members]
    );
    const validIds = stillUnclustered.rows.map((r) => r.id);
    if (validIds.length < 2) continue;

    const cluster = await clusterRepo.createCluster(validIds);
    clustersCreated++;
    articlesAssigned += validIds.length;
    logger.debug('Second pass cluster', { clusterId: cluster.id, articles: validIds.length });
  }

  if (clustersCreated > 0) {
    logger.info(`Second pass: formed ${clustersCreated} new clusters from ${articlesAssigned} previously unclustered articles`);
  }

  return { clustersCreated, articlesAssigned };
}

/**
 * Archive clusters that haven't received new articles in 72 hours.
 */
async function archiveStaleClusters() {
  const result = await query(`
    UPDATE story_clusters SET is_active = FALSE, archived_at = NOW()
    WHERE is_active = TRUE
      AND id NOT IN (
        SELECT DISTINCT cluster_id FROM articles
        WHERE cluster_id IS NOT NULL
          AND ingested_at > NOW() - INTERVAL '72 hours'
      )
    RETURNING id
  `);

  if (result.rowCount > 0) {
    logger.info(`Archived ${result.rowCount} stale clusters`);
  }
}
