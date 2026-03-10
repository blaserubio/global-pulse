import { query } from '../db/pool.js';
import logger from './logger.js';

/**
 * Log every Claude API call with token counts for cost tracking.
 * Call this after every Anthropic API request.
 */
export async function trackApiCall({ operation, model, inputTokens, outputTokens, clusterId, articleId }) {
  try {
    await query(
      `INSERT INTO api_cost_log (operation, model, input_tokens, output_tokens, cluster_id, article_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [operation, model, inputTokens, outputTokens, clusterId || null, articleId || null]
    );
  } catch (err) {
    logger.debug('Failed to log API cost', { error: err.message });
  }
}

/**
 * Get cost summary for a time period.
 */
export async function getCostSummary(hoursBack = 24) {
  const result = await query(`
    SELECT operation,
           COUNT(*)::int AS calls,
           SUM(input_tokens)::int AS total_input,
           SUM(output_tokens)::int AS total_output
    FROM api_cost_log
    WHERE created_at > NOW() - make_interval(hours => $1)
    GROUP BY operation
    ORDER BY total_input DESC
  `, [hoursBack]);
  return result.rows;
}
