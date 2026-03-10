import { URL } from 'node:url';
import { lookup } from 'node:dns/promises';
import Parser from 'rss-parser';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Validate a feed URL is safe to fetch (SSRF protection).
 * Blocks: non-HTTP(S) schemes, private/internal IPs, localhost.
 */
async function isSafeUrl(feedUrl) {
  try {
    const parsed = new URL(feedUrl);

    // Only allow HTTP(S)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname;

    // Block obvious internal hostnames
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
        hostname === '0.0.0.0' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return false;
    }

    // Block cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return false;
    }

    // Resolve DNS and check for private IP ranges
    const { address } = await lookup(hostname);
    const parts = address.split('.').map(Number);

    // RFC 1918 private ranges
    if (parts[0] === 10) return false;                                         // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;   // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return false;                   // 192.168.0.0/16
    if (parts[0] === 127) return false;                                        // 127.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return false;                   // link-local

    return true;
  } catch {
    // If URL parsing or DNS resolution fails, reject
    return false;
  }
}

const MAX_RSS_BODY_BYTES = 5 * 1024 * 1024; // 5 MB max response size

const parser = new Parser({
  timeout: config.ingestion.rssTimeoutMs,
  headers: { 'User-Agent': 'GlobalPulse/1.0 (news-aggregator; +https://globalpulse.news)' },
  maxRedirects: 3,
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['dc:creator', 'dc:creator'],
    ],
  },
  requestOptions: {
    // Abort if content-length header exceeds limit
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
  },
});

// Patch parser to enforce response size limit
const origParseURL = parser.parseURL.bind(parser);
parser.parseURL = async function (url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.ingestion.rssTimeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GlobalPulse/1.0 (news-aggregator; +https://globalpulse.news)' },
      redirect: 'follow',
    });

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_RSS_BODY_BYTES) {
      throw new Error(`RSS response too large: ${contentLength} bytes`);
    }

    // Read body with size enforcement
    const reader = res.body.getReader();
    const chunks = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > MAX_RSS_BODY_BYTES) {
        reader.cancel();
        throw new Error(`RSS response exceeded ${MAX_RSS_BODY_BYTES} byte limit`);
      }
      chunks.push(value);
    }

    const body = Buffer.concat(chunks).toString('utf-8');
    return await parser.parseString(body);
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Fetch and parse a single RSS feed.
 * @param {string} feedUrl
 * @param {string} sourceId
 * @param {string} [feedLanguage]
 * @returns {Promise<object[]>} Array of raw article objects
 */
export async function fetchRssFeed(feedUrl, sourceId, feedLanguage) {
  try {
    // SSRF protection: validate URL before fetching
    const safe = await isSafeUrl(feedUrl);
    if (!safe) {
      logger.warn('RSS feed URL blocked by SSRF protection', { feedUrl });
      return [];
    }

    const feed = await parser.parseURL(feedUrl);
    const items = (feed.items || []).slice(0, config.ingestion.rssMaxItems);

    return items.map((item) => ({
      source_id: sourceId,
      title: String(item.title || ''),
      body_text: String(item.content || item.contentSnippet || item.description || ''),
      url: String(item.link || ''),
      image_url: null,
      author: item.creator || item['dc:creator'] || null,
      language: feedLanguage || null,
      published_at: item.isoDate || item.pubDate || null,
      // Pass through for image extraction in normalizer
      enclosure: item.enclosure,
      'media:content': item['media:content'],
    }));
  } catch (err) {
    logger.error('RSS fetch failed', { feedUrl, error: err.message });
    return [];
  }
}

/**
 * Fetch all RSS feeds for a source.
 * @param {object} source - Source record with rss_feeds JSONB
 * @returns {Promise<{ articles: object[], feedResults: object[] }>}
 */
export async function fetchAllFeedsForSource(source) {
  const feeds = source.rss_feeds || [];
  const allArticles = [];
  const feedResults = [];

  for (const feed of feeds) {
    const startedAt = new Date();
    try {
      const articles = await fetchRssFeed(feed.url, source.id, feed.language || source.language);
      allArticles.push(...articles);
      feedResults.push({
        source_id: source.id,
        feed_url: feed.url,
        status: 'success',
        articles_found: articles.length,
        started_at: startedAt,
        completed_at: new Date(),
        duration_ms: Date.now() - startedAt.getTime(),
      });
    } catch (err) {
      feedResults.push({
        source_id: source.id,
        feed_url: feed.url,
        status: 'failed',
        articles_found: 0,
        error_message: err.message,
        started_at: startedAt,
        completed_at: new Date(),
        duration_ms: Date.now() - startedAt.getTime(),
      });
    }
  }

  return { articles: allArticles, feedResults };
}
