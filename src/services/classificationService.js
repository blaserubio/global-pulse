import Anthropic from '@anthropic-ai/sdk';
import config from '../config/index.js';
import * as clusterRepo from './clusterRepo.js';
import { trackApiCall } from '../utils/apiCostTracker.js';
import logger from '../utils/logger.js';

const TOPICS = [
  'Politics & Governance',
  'Conflict & Security',
  'Economy & Business',
  'Science & Technology',
  'Climate & Environment',
  'Health',
  'Culture & Society',
  'Sports',
  'Crime & Justice',
  'Education',
  'Human Rights',
  'Diplomacy & International Relations',
];

function getClient() {
  const key = config.apis.anthropic.key;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/**
 * Classify a cluster's topic using Claude API.
 * @param {object} cluster - Cluster with sample_articles
 * @returns {Promise<{ topic: string, sub_topic: string } | null>}
 */
async function classifyTopic(cluster) {
  const client = getClient();
  if (!client) {
    logger.warn('No Anthropic API key — skipping topic classification');
    return null;
  }

  const articles = cluster.sample_articles || [];
  const articleText = articles
    .map((a, i) => `Article ${i + 1}: ${a.title}\n${(a.body_text || '').slice(0, 200)}`)
    .join('\n\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Classify this news story into ALL applicable categories from the following list. A story can belong to multiple categories. For each applicable category, provide a confidence score (0.0 to 1.0).

Categories: ${TOPICS.join(', ')}

Articles:
${articleText}

Return ONLY a JSON array, no markdown, no backticks:
[{"topic": "...", "sub_topic": "...", "confidence": 0.95}, ...]

Include only categories with confidence >= 0.6. The first item should be the primary (highest confidence) category.`,
      }],
    });

    await trackApiCall({
      operation: 'classification',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      clusterId: cluster.id,
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    let parsed = JSON.parse(text);
    // Handle single object response
    if (!Array.isArray(parsed)) parsed = [parsed];
    // Handle nested array format (array of arrays)
    if (parsed.length > 0 && Array.isArray(parsed[0])) {
      const flat = parsed.flat();
      const byTopic = new Map();
      for (const t of flat) {
        if (t.topic && (!byTopic.has(t.topic) || t.confidence > byTopic.get(t.topic).confidence)) {
          byTopic.set(t.topic, t);
        }
      }
      parsed = Array.from(byTopic.values()).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }
    // Handle per-article classification format (flatten to topic list)
    if (parsed.length > 0 && (parsed[0].classifications || parsed[0].categories)) {
      const flat = [];
      for (const item of parsed) {
        const cats = item.classifications || item.categories;
        if (Array.isArray(cats)) flat.push(...cats);
      }
      // Deduplicate by topic, keeping highest confidence
      const byTopic = new Map();
      for (const t of flat) {
        if (!byTopic.has(t.topic) || t.confidence > byTopic.get(t.topic).confidence) {
          byTopic.set(t.topic, t);
        }
      }
      parsed = Array.from(byTopic.values()).sort((a, b) => b.confidence - a.confidence);
    }
    // Filter to valid topics
    const validTopics = parsed.filter((t) => TOPICS.includes(t.topic));
    if (validTopics.length > 0) {
      return {
        topic: validTopics[0].topic,
        sub_topic: validTopics[0].sub_topic || '',
        topics: validTopics.map((t) => ({
          topic: t.topic,
          sub_topic: t.sub_topic || '',
          confidence: t.confidence || 1.0,
        })),
      };
    }
    logger.warn('No valid topics returned', { raw: text });
    return null;
  } catch (err) {
    logger.error('Topic classification failed', { clusterId: cluster.id, error: err.message });
    await clusterRepo.recordEnrichmentFailure(cluster.id);
    return null;
  }
}

/**
 * Generate a neutral canonical title for a cluster using Claude API.
 * @param {object[]} articles - Array of article objects with titles
 * @returns {Promise<string|null>}
 */
async function generateCanonicalTitle(articles) {
  const client = getClient();
  if (!client) return null;

  const titles = articles.map((a) => a.title).filter(Boolean).slice(0, 5);
  if (titles.length === 0) return null;

  // If titles are generic/placeholder, include body text for context
  const hasRealTitles = titles.some((t) =>
    t.length > 20 && !/^this is what happened/i.test(t) && !/^placeholder/i.test(t)
  );

  let prompt;
  if (hasRealTitles) {
    prompt = `Given these headlines about the same event, write ONE neutral, factual headline that captures the core event without editorializing. Return only the headline, no quotes or explanation.

Headlines:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  } else {
    // Fall back to body text
    const excerpts = articles
      .map((a) => (a.body_text || '').slice(0, 300))
      .filter((t) => t.length > 20)
      .slice(0, 3);
    if (excerpts.length === 0) return null;
    prompt = `Based on the following news article excerpts, write ONE neutral, factual headline that captures the core event. Return only the headline, no quotes or explanation.

Excerpts:
${excerpts.map((e, i) => `${i + 1}. ${e}`).join('\n\n')}`;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    await trackApiCall({
      operation: 'title_generation',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    const result = response.content[0].text.trim();

    // Reject if Claude returned a refusal or question instead of a headline
    if (result.length > 150 || result.includes('?') && result.startsWith('Without') || result.startsWith('I ') || result.startsWith('Could you')) {
      logger.warn('Title generation returned non-headline response', { response: result.slice(0, 100) });
      return null;
    }

    return result;
  } catch (err) {
    logger.error('Canonical title generation failed', { error: err.message });
    return null;
  }
}

/**
 * Generate a comparative framing analysis for a multi-region cluster.
 * @param {object} cluster - Cluster with articles array
 * @returns {Promise<string|null>}
 */
async function generateFramingAnalysis(cluster) {
  const client = getClient();
  if (!client) return null;

  const articles = cluster.articles || [];
  if (articles.length < 2) return null;

  const articleSummaries = articles.map((a) =>
    `Source: ${a.source_name} (${a.region}, ${a.country_code}, lean: ${a.editorial_lean})\nHeadline: ${a.title}\nExcerpt: ${(a.body_text || '').slice(0, 300)}`
  ).join('\n\n---\n\n');

  // Adaptive prompt based on cluster size
  const prompt = articles.length === 2
    ? `Compare how these two sources cover the same event. Note specific differences in: what facts each emphasizes, how they attribute claims, what context each provides, and anything one includes that the other omits. Be concise and observational — do not judge which framing is more correct.

Sources:

${articleSummaries}

Write a concise comparative analysis (2-3 paragraphs):`
    : `Compare how these different news sources cover the same event. Note differences in:
- Emphasis and framing (what each source leads with)
- Attribution (who is quoted or blamed)
- What is included vs. omitted by different sources
- Tone (urgent vs. measured, sympathetic vs. critical)
- Regional perspective differences

Present your observations neutrally without judging which framing is more correct. Be specific with examples from the articles.

Sources covering this story:

${articleSummaries}

Write a concise comparative analysis (3-4 paragraphs):`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
    await trackApiCall({
      operation: 'framing_analysis',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      clusterId: cluster.id,
    });

    return response.content[0].text.trim();
  } catch (err) {
    logger.error('Framing analysis failed', { clusterId: cluster.id, error: err.message });
    await clusterRepo.recordEnrichmentFailure(cluster.id);
    return null;
  }
}

/**
 * Determine the framing type for a cluster.
 */
function determineFramingType(cluster) {
  const articles = cluster.articles || [];
  const regions = new Set(articles.map((a) => a.region));
  const countries = new Set(articles.map((a) => a.country_code));
  const leans = new Set(articles.map((a) => a.editorial_lean).filter((l) => l && l !== 'unknown'));

  if (regions.size >= 2 && (cluster.source_count || articles.length) >= 3) return 'full';
  if (regions.size >= 2) return 'multi_region';
  if (leans.size >= 2) return 'multi_lean';
  if (countries.size >= 2) return 'multi_country';
  return 'full';
}

/**
 * Classify topics for all clusters that need them.
 * @returns {Promise<number>} Number of clusters classified
 */
export async function classifyAllPendingTopics() {
  const clusters = await clusterRepo.getClustersNeedingTopics(20);
  if (clusters.length === 0) return 0;

  logger.info(`Classifying topics for ${clusters.length} clusters`);
  let classified = 0;

  for (const cluster of clusters) {
    const result = await classifyTopic(cluster);
    if (result) {
      await clusterRepo.updateClusterTopic(cluster.id, result.topic, result.sub_topic, result.topics || []);
      classified++;
    }
  }

  logger.info(`Classified ${classified}/${clusters.length} clusters`);
  return classified;
}

/**
 * Generate canonical titles for all clusters that need them.
 * @returns {Promise<number>} Number of clusters titled
 */
export async function titleAllPendingClusters() {
  const clusters = await clusterRepo.getClustersNeedingTitles(20);
  if (clusters.length === 0) return 0;

  logger.info(`Generating titles for ${clusters.length} clusters`);
  let titled = 0;

  for (const cluster of clusters) {
    const articles = cluster.sample_articles || [];
    let title = await generateCanonicalTitle(articles);

    // Fallback: use the longest real article title if Claude can't generate one
    if (!title) {
      const candidates = articles
        .map((a) => a.title)
        .filter((t) => t && t.length > 15 && !/^this is what happened/i.test(t));
      if (candidates.length > 0) {
        title = candidates.sort((a, b) => b.length - a.length)[0];
      }
    }

    if (title) {
      await clusterRepo.updateClusterTitle(cluster.id, title);
      titled++;
    }
  }

  logger.info(`Titled ${titled}/${clusters.length} clusters`);
  return titled;
}

/**
 * Generate framing analysis and canonical titles for qualifying clusters.
 * @returns {Promise<number>} Number of clusters analyzed
 */
export async function analyzeAllPendingFraming() {
  const clusters = await clusterRepo.getClustersNeedingFraming(10);
  if (clusters.length === 0) return 0;

  logger.info(`Generating framing analysis for ${clusters.length} clusters`);
  let analyzed = 0;

  for (const cluster of clusters) {
    const [summary, title] = await Promise.all([
      generateFramingAnalysis(cluster),
      generateCanonicalTitle(cluster.articles || []),
    ]);

    if (summary || title) {
      const framingType = summary ? determineFramingType(cluster) : null;
      await clusterRepo.updateClusterSummary(
        cluster.id,
        summary,
        title || cluster.canonical_title,
        framingType
      );
      analyzed++;
    }
  }

  logger.info(`Analyzed ${analyzed}/${clusters.length} clusters`);
  return analyzed;
}
