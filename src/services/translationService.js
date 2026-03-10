import Anthropic from '@anthropic-ai/sdk';
import config from '../config/index.js';
import { query } from '../db/pool.js';
import { trackApiCall } from '../utils/apiCostTracker.js';
import logger from '../utils/logger.js';

function getClient() {
  const key = config.apis.anthropic.key;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/**
 * Translate title and body_text to English using Claude API.
 * @param {string} title
 * @param {string} bodyText
 * @param {string} language - ISO language code
 * @returns {Promise<{ title: string, body_text: string } | null>}
 */
export async function translateToEnglish(title, bodyText, language) {
  const client = getClient();
  if (!client) {
    logger.warn('No Anthropic API key — skipping translation');
    return null;
  }

  const excerpt = (bodyText || '').slice(0, 1000);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Translate the following news article from ${language} to English. Preserve the journalistic tone and meaning. Return ONLY valid JSON with no other text.

Title: ${title}
${excerpt ? `\nBody excerpt:\n${excerpt}` : ''}

Respond in exactly this JSON format:
{"title": "English title", "body_text": "English body text"}`,
      }],
    });

    await trackApiCall({
      operation: 'translation',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      articleId: undefined,
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(text);
    return {
      title: parsed.title || title,
      body_text: parsed.body_text || bodyText,
    };
  } catch (err) {
    logger.error('Translation failed', { language, error: err.message });
    return null;
  }
}

/**
 * Translate all non-English articles that haven't been translated yet.
 * Stores translations in translated_title/translated_body_text columns,
 * preserving the original language text in title/body_text.
 * @returns {Promise<number>} Number of articles translated
 */
export async function translateAllPending() {
  const result = await query(
    `SELECT id, title, body_text, language
     FROM articles
     WHERE language IS NOT NULL
       AND language != 'en'
       AND translated_title IS NULL
     ORDER BY published_at DESC
     LIMIT 50`
  );

  if (result.rows.length === 0) return 0;

  logger.info(`Translating ${result.rows.length} non-English articles`);
  let translated = 0;

  for (const article of result.rows) {
    const translation = await translateToEnglish(article.title, article.body_text, article.language);
    if (translation) {
      await query(
        `UPDATE articles
         SET translated_title = $2,
             translated_body_text = $3
         WHERE id = $1`,
        [article.id, translation.title, translation.body_text]
      );
      translated++;
    }
  }

  logger.info(`Translated ${translated}/${result.rows.length} articles`);
  return translated;
}
