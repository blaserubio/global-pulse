import config from '../config/index.js';
import logger from '../utils/logger.js';

const REGION_COUNTRIES = {
  americas: ['us', 'ca', 'br', 'mx', 'ar'],
  europe: ['gb', 'de', 'fr', 'nl', 'es', 'it'],
  asia_pacific: ['cn', 'jp', 'in', 'au', 'kr', 'sg'],
  mideast_africa: ['ae', 'il', 'ng', 'za', 'eg'],
};

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch from NewsAPI.org by country.
 * @param {string} countryCode
 * @returns {Promise<object[]>}
 */
async function fetchNewsApi(countryCode) {
  const key = config.apis.newsapi.key;
  if (!key) return [];
  try {
    const url = `https://newsapi.org/v2/top-headlines?country=${countryCode}&pageSize=50&apiKey=${key}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn('NewsAPI error', { status: res.status, country: countryCode });
      return [];
    }
    const data = await res.json();
    return (data.articles || []).map((a) => ({
      title: a.title || '',
      body_text: a.content || a.description || '',
      url: a.url || '',
      image_url: a.urlToImage || null,
      author: a.author || null,
      published_at: a.publishedAt || null,
      source_name: a.source?.name || null,
      language: null,
    }));
  } catch (err) {
    logger.error('NewsAPI fetch failed', { country: countryCode, error: err.message });
    return [];
  }
}

/**
 * Fetch from GNews.io by country.
 * @param {string} countryCode
 * @returns {Promise<object[]>}
 */
async function fetchGNews(countryCode) {
  const key = config.apis.gnews.key;
  if (!key) return [];
  try {
    const url = `https://gnews.io/api/v4/top-headlines?country=${countryCode}&max=50&apikey=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).map((a) => ({
      title: a.title || '',
      body_text: a.content || a.description || '',
      url: a.url || '',
      image_url: a.image || null,
      author: a.source?.name || null,
      published_at: a.publishedAt || null,
      source_name: a.source?.name || null,
      language: null,
    }));
  } catch (err) {
    logger.error('GNews fetch failed', { country: countryCode, error: err.message });
    return [];
  }
}

/**
 * Fetch from Mediastack by country.
 * @param {string} countryCode
 * @returns {Promise<object[]>}
 */
async function fetchMediastack(countryCode) {
  const key = config.apis.mediastack.key;
  if (!key) return [];
  try {
    const url = `https://api.mediastack.com/v1/news?access_key=${key}&countries=${countryCode}&limit=50`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((a) => ({
      title: a.title || '',
      body_text: a.description || '',
      url: a.url || '',
      image_url: a.image || null,
      author: a.author || null,
      published_at: a.published_at || null,
      source_name: a.source || null,
      language: a.language || null,
    }));
  } catch (err) {
    logger.error('Mediastack fetch failed', { country: countryCode, error: err.message });
    return [];
  }
}

/**
 * Fetch headlines from all three API services across all regions.
 * @returns {Promise<object[]>} Array of raw articles with source_name attached
 */
export async function fetchAllNewsApis() {
  const allArticles = [];
  const countries = [...new Set(Object.values(REGION_COUNTRIES).flat())];

  // Fetch from all three APIs in parallel for each country
  for (const country of countries) {
    const [newsapi, gnews, mediastack] = await Promise.allSettled([
      fetchNewsApi(country),
      fetchGNews(country),
      fetchMediastack(country),
    ]);

    if (newsapi.status === 'fulfilled') allArticles.push(...newsapi.value);
    if (gnews.status === 'fulfilled') allArticles.push(...gnews.value);
    if (mediastack.status === 'fulfilled') allArticles.push(...mediastack.value);

    // Rate limiting: 250ms between country batches
    await sleep(250);
  }

  logger.info('News APIs fetch complete', { totalArticles: allArticles.length });
  return allArticles;
}
