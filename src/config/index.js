import 'dotenv/config';

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://globalpulse:globalpulse@localhost:5432/globalpulse',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  apis: {
    newsapi: { key: process.env.NEWSAPI_KEY || '' },
    gnews: { key: process.env.GNEWS_KEY || '' },
    mediastack: { key: process.env.MEDIASTACK_KEY || '' },
    anthropic: { key: process.env.ANTHROPIC_API_KEY || '' },
  },

  clustering: {
    similarityThreshold: parseFloat(process.env.CLUSTERING_SIMILARITY_THRESHOLD || '0.90'),
    embeddingBatchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '50', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  ingestion: {
    intervalMinutes: parseInt(process.env.INGESTION_INTERVAL_MINUTES || '15', 10),
    rssTimeoutMs: parseInt(process.env.RSS_TIMEOUT_MS || '20000', 10),
    rssMaxItems: parseInt(process.env.RSS_MAX_ITEMS || '20', 10),
  },

  adminApiKey: process.env.ADMIN_API_KEY || '',
  sentryDsn: process.env.SENTRY_DSN || '',
  logtailToken: process.env.LOGTAIL_TOKEN || '',
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
