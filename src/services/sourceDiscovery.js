import Anthropic from '@anthropic-ai/sdk';
import config from '../config/index.js';
import * as pendingSourceRepo from './pendingSourceRepo.js';
import logger from '../utils/logger.js';

function getClient() {
  const key = config.apis.anthropic.key;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/**
 * Use Claude to research a news outlet and assess its credibility.
 * @param {object} source - Pending source record
 * @returns {Promise<object|null>}
 */
async function assessSource(source) {
  const client = getClient();
  if (!client) return null;

  const sampleTitles = (source.sample_articles || [])
    .map((a) => a.title)
    .filter(Boolean)
    .slice(0, 5)
    .join('\n- ');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Research the news outlet "${source.name}" (${source.url || 'URL unknown'}). Based on your knowledge, determine:

1. Country of origin (ISO 2-letter code)
2. Region (americas, europe, asia_pacific, or mideast_africa)
3. Primary language
4. Funding model (state_funded, public, private, nonprofit, or unknown)
5. Editorial lean (left, center_left, center, center_right, right, or unknown)
6. Factual reliability (very_high, high, mostly_factual, mixed, low, or unknown)
7. Ownership (brief description)
8. A brief assessment of whether this is a legitimate news outlet worth tracking

Sample article titles from this source:
- ${sampleTitles || 'No samples available'}

Return ONLY valid JSON:
{"country_code": "XX", "region": "...", "language": "en", "funding_model": "...", "editorial_lean": "...", "factual_rating": "...", "ownership": "...", "is_legitimate": true, "assessment": "Brief explanation"}`,
      }],
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    return JSON.parse(text);
  } catch (err) {
    logger.error('Source assessment failed', { name: source.name, error: err.message });
    return null;
  }
}

/**
 * Run the source discovery job: assess frequently-seen pending sources.
 * @returns {Promise<{ assessed: number, flagged: number }>}
 */
export async function runSourceDiscovery() {
  const sources = await pendingSourceRepo.getSourcesNeedingAssessment(5, 10);
  if (sources.length === 0) {
    logger.info('Source discovery: no sources need assessment');
    return { assessed: 0, flagged: 0 };
  }

  logger.info(`Source discovery: assessing ${sources.length} pending sources`);
  let assessed = 0;
  let flagged = 0;

  for (const source of sources) {
    const assessment = await assessSource(source);
    if (assessment) {
      await pendingSourceRepo.updateAiAssessment(source.id, assessment);
      assessed++;

      if (source.times_seen >= 10 && assessment.is_legitimate) {
        flagged++;
        logger.info(`Source flagged for priority review: ${source.name} (seen ${source.times_seen} times, legitimate: ${assessment.is_legitimate})`);
      }
    }
  }

  logger.info(`Source discovery: ${assessed} assessed, ${flagged} flagged for review`);
  return { assessed, flagged };
}
