-- API cost tracking for Claude API usage
CREATE TABLE IF NOT EXISTS api_cost_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation       TEXT NOT NULL,
    model           TEXT NOT NULL,
    input_tokens    INT DEFAULT 0,
    output_tokens   INT DEFAULT 0,
    cluster_id      UUID,
    article_id      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_log_created ON api_cost_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_log_operation ON api_cost_log(operation, created_at DESC);

-- Enrichment retry tracking
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS enrichment_attempts INT DEFAULT 0;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS enrichment_failed_at TIMESTAMPTZ;
