import Anthropic from '@anthropic-ai/sdk';
import config from '../config/index.js';
import { query } from '../db/pool.js';
import { cacheGet, cacheSet } from './cache.js';
import logger from '../utils/logger.js';

const CACHE_KEY = 'psychology-map';
const CACHE_TTL = 1800; // 30 minutes

function getClient() {
  const key = config.apis.anthropic.key;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/**
 * Get the psychology map — cached analysis of psychological tactics across all active stories.
 */
export async function getPsychologyMap() {
  // Check cache first
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return cached;

  // Fetch ALL active stories with their titles, topics, and framing summaries
  const res = await query(`
    SELECT sc.id, sc.canonical_title, sc.topic, sc.summary, sc.source_count,
           sc.region_count, sc.significance
    FROM story_clusters sc
    WHERE sc.is_active = TRUE
      AND sc.canonical_title IS NOT NULL
      AND sc.archived_at IS NULL
    ORDER BY sc.significance DESC
  `);

  if (res.rows.length === 0) {
    return { tactics: [], story_count: 0, generated_at: new Date().toISOString() };
  }

  // For stories with framing summaries, include a truncated version
  // For the rest, just include title + topic + source count
  const storySummaries = res.rows.map((r, i) => {
    const header = `${i + 1}. "${r.canonical_title}" (Topic: ${r.topic || 'Unknown'}, ${r.source_count} sources)`;
    if (r.summary) {
      const truncated = r.summary.slice(0, 400);
      return `${header}\n${truncated}`;
    }
    return header;
  }).join('\n\n');

  const client = getClient();
  if (!client) {
    logger.warn('No Anthropic API key — cannot generate psychology map');
    return { tactics: [], story_count: res.rows.length, generated_at: new Date().toISOString() };
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a media psychology analyst. Below are the top ${res.rows.length} news stories currently being covered by global media outlets, along with framing analysis showing how different sources cover them.

Analyze ALL these stories and identify the psychological tactics and persuasion techniques being used across the news coverage. For each tactic, count how many of the stories employ it.

${storySummaries}

Return a JSON array of tactics, sorted from most frequently used to least. Each tactic should have:
- "name": Short label for the tactic (2-5 words)
- "count": How many stories use this tactic
- "percentage": Percentage of stories using it (rounded integer)
- "description": 1-2 sentence explanation of what this tactic is
- "why_used": 1-2 sentences explaining why news outlets use this tactic — what psychological effect it has on readers
- "examples": Array of 1-3 story titles from the list above that demonstrate this tactic

Return ONLY valid JSON. No markdown, no code fences. Example format:
[{"name":"Fear Appeal","count":15,"percentage":75,"description":"Using threat or danger to create urgency.","why_used":"Fear activates the amygdala, making readers more likely to engage, share, and return for updates.","examples":["Story title 1","Story title 2"]}]`
      }],
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const tactics = JSON.parse(text);

    const result = {
      tactics,
      story_count: res.rows.length,
      generated_at: new Date().toISOString(),
    };

    await cacheSet(CACHE_KEY, result, CACHE_TTL);
    logger.info(`Psychology map generated: ${tactics.length} tactics from ${res.rows.length} stories`);
    return result;
  } catch (err) {
    logger.error('Psychology map generation failed', { error: err.message });
    return { tactics: [], story_count: res.rows.length, generated_at: new Date().toISOString(), error: 'Analysis failed' };
  }
}
