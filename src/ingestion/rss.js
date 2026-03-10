import Parser from 'rss-parser';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const parser = new Parser({
  timeout: config.ingestion.rssTimeoutMs,
  headers: { 'User-Agent': 'GlobalPulse/1.0 (news-aggregator; +https://globalpulse.news)' },
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['dc:creator', 'dc:creator'],
    ],
  },
});

/**
 * Fetch and parse a single RSS feed.
 * @param {string} feedUrl
 * @param {string} sourceId
 * @param {string} [feedLanguage]
 * @returns {Promise<object[]>} Array of raw article objects
 */
export async function fetchRssFeed(feedUrl, sourceId, feedLanguage) {
  try {
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
