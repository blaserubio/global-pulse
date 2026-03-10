-- Migration 002: Architecture improvements
-- Adds: pending_sources, multi-topic, velocity scoring, cluster archiving,
-- multilingual embeddings (1024 dims), translation columns, image selection, framing types

-- Pending sources for discovery pipeline
CREATE TABLE IF NOT EXISTS pending_sources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    url             TEXT,
    country_code    CHAR(2),
    region          TEXT,
    times_seen      INT DEFAULT 1,
    first_seen      TIMESTAMPTZ DEFAULT NOW(),
    last_seen       TIMESTAMPTZ DEFAULT NOW(),
    sample_articles JSONB DEFAULT '[]',
    status          TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'ignored')) DEFAULT 'pending',
    reviewed_at     TIMESTAMPTZ,
    ai_assessment   JSONB,
    CONSTRAINT pending_sources_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_pending_sources_status ON pending_sources(status);
CREATE INDEX IF NOT EXISTS idx_pending_sources_seen ON pending_sources(times_seen DESC);

-- Article additions
ALTER TABLE articles ADD COLUMN IF NOT EXISTS original_title TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS original_body_text TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS translated_title TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS translated_body_text TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS topics JSONB DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_articles_topics ON articles USING GIN (topics);

-- Hash prefix index for optimized deduplication
CREATE INDEX IF NOT EXISTS idx_articles_hash_prefix ON articles (LEFT(content_hash, 4), ingested_at DESC) WHERE content_hash IS NOT NULL;

-- Story cluster additions
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS velocity INT DEFAULT 0;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS acceleration INT DEFAULT 0;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS hours_since_update FLOAT DEFAULT 0;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS topics JSONB DEFAULT '[]';
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS framing_type TEXT CHECK (framing_type IN ('multi_region', 'multi_lean', 'multi_country', 'full'));
CREATE INDEX IF NOT EXISTS idx_clusters_topics ON story_clusters USING GIN (topics);

-- NOTE: Embedding dimension change (384 -> 1024) requires:
-- UPDATE articles SET embedding = NULL;
-- DROP INDEX IF EXISTS articles_embedding_idx;
-- ALTER TABLE articles ALTER COLUMN embedding TYPE vector(1024);
-- CREATE INDEX articles_embedding_idx ON articles USING hnsw (embedding vector_cosine_ops);
-- Then re-run: npm run intelligence
