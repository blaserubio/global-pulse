-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Region enum
CREATE TYPE region_type AS ENUM ('americas', 'europe', 'asia_pacific', 'mideast_africa');

-- Funding model enum
CREATE TYPE funding_model_type AS ENUM ('state_funded', 'public', 'private', 'nonprofit', 'unknown');

-- Editorial lean enum
CREATE TYPE editorial_lean_type AS ENUM ('left', 'center_left', 'center', 'center_right', 'right', 'unknown');

-- Factual rating enum
CREATE TYPE factual_rating_type AS ENUM ('very_high', 'high', 'mostly_factual', 'mixed', 'low', 'unknown');

-- Ingestion status enum
CREATE TYPE ingestion_status_type AS ENUM ('success', 'partial', 'failed');

-- ============================================================
-- SOURCES
-- ============================================================
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  rss_feeds JSONB DEFAULT '[]'::jsonb,
  country_code CHAR(2) NOT NULL,
  region region_type NOT NULL,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  funding_model funding_model_type NOT NULL DEFAULT 'unknown',
  editorial_lean editorial_lean_type NOT NULL DEFAULT 'unknown',
  factual_rating factual_rating_type NOT NULL DEFAULT 'unknown',
  ownership TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STORY CLUSTERS (Phase 2 ready)
-- ============================================================
CREATE TABLE story_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_title TEXT,
  summary TEXT,
  topic TEXT,
  sub_topic TEXT,
  source_count INT DEFAULT 0,
  country_count INT DEFAULT 0,
  region_count INT DEFAULT 0,
  significance FLOAT DEFAULT 0,
  regions JSONB DEFAULT '[]'::jsonb,
  countries JSONB DEFAULT '[]'::jsonb,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- ARTICLES
-- ============================================================
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_text TEXT,
  summary TEXT,
  url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  author TEXT,
  language VARCHAR(5),
  topic TEXT,
  sub_topic TEXT,
  content_hash TEXT,
  canonical_id UUID REFERENCES articles(id),
  cluster_id UUID REFERENCES story_clusters(id),
  embedding vector(384),
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INGESTION LOGS
-- ============================================================
CREATE TABLE ingestion_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  feed_url TEXT,
  status ingestion_status_type NOT NULL DEFAULT 'success',
  articles_found INT DEFAULT 0,
  articles_new INT DEFAULT 0,
  articles_duped INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT DEFAULT 0
);

-- ============================================================
-- COVERAGE EVENTS (Phase 4 ready)
-- ============================================================
CREATE TABLE coverage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID REFERENCES story_clusters(id) ON DELETE CASCADE,
  prominent_in JSONB DEFAULT '[]'::jsonb,
  absent_from JSONB DEFAULT '[]'::jsonb,
  gap_score FLOAT DEFAULT 0,
  context TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_articles_source_id ON articles(source_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_topic ON articles(topic);
CREATE INDEX idx_articles_content_hash ON articles(content_hash);
CREATE INDEX idx_articles_cluster_id ON articles(cluster_id);
CREATE INDEX idx_articles_canonical_id ON articles(canonical_id);
CREATE INDEX idx_articles_ingested_at ON articles(ingested_at DESC);

CREATE INDEX idx_ingestion_logs_source_id ON ingestion_logs(source_id);
CREATE INDEX idx_ingestion_logs_started_at ON ingestion_logs(started_at DESC);

CREATE INDEX idx_story_clusters_topic ON story_clusters(topic);
CREATE INDEX idx_story_clusters_significance ON story_clusters(significance DESC);
CREATE INDEX idx_story_clusters_last_updated ON story_clusters(last_updated DESC);

CREATE INDEX idx_coverage_events_cluster_id ON coverage_events(cluster_id);
CREATE INDEX idx_coverage_events_gap_score ON coverage_events(gap_score DESC);

CREATE INDEX idx_sources_region ON sources(region);
CREATE INDEX idx_sources_country_code ON sources(country_code);

-- Migration tracking
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
