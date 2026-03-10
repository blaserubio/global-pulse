import sanitizeHtml from 'sanitize-html';

const BLOCK_TAGS = ['p', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];

/**
 * Strip HTML but preserve paragraph breaks from block elements.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  if (!html) return '';
  if (typeof html !== 'string') html = String(html);
  // Replace block tags with newlines before stripping
  let text = html;
  for (const tag of BLOCK_TAGS) {
    text = text.replace(new RegExp(`</${tag}>`, 'gi'), '\n');
    text = text.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '\n');
  }
  text = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse whitespace but preserve paragraph breaks
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n[ \t]+/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * Extract the best image URL from various RSS/API fields.
 * @param {object} item - Raw article item
 * @returns {string|null}
 */
function extractImage(item) {
  if (item.urlToImage) return item.urlToImage;
  if (item.image) return typeof item.image === 'string' ? item.image : item.image?.url || null;
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image')) return item.enclosure.url;
  if (item['media:content']?.$?.url) return item['media:content'].$.url;
  if (item.media?.url) return item.media.url;
  return null;
}

/**
 * Normalize a URL by stripping tracking parameters.
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Parse a date string robustly. Returns null for invalid or future dates.
 * @param {string|Date} dateInput
 * @returns {Date|null}
 */
function parseDate(dateInput) {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  // Reject dates more than 7 days in the future
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  if (date > weekFromNow) return null;
  return date;
}

/**
 * Normalize a raw article from any source into a unified schema.
 * @param {object} raw - Raw article data
 * @param {string} sourceId - UUID of the source
 * @returns {{ source_id: string, title: string, body_text: string, url: string, image_url: string|null, author: string|null, language: string|null, published_at: Date|null }}
 */
export function normalizeArticle(raw, sourceId) {
  const title = stripHtml(raw.title || '').slice(0, 1000);
  const bodyRaw = raw.body_text || raw.content || raw.contentSnippet || raw.description || '';
  const body_text = stripHtml(bodyRaw);
  const url = normalizeUrl(raw.url || raw.link || '');
  const image_url = extractImage(raw);
  const author = raw.author || raw.creator || raw['dc:creator'] || null;
  const language = raw.language || null;
  const published_at = parseDate(raw.published_at || raw.pubDate || raw.publishedAt || raw.isoDate);

  return { source_id: sourceId, title, body_text, url, image_url, author, language, published_at };
}
