# Global Pulse

Global news intelligence platform — multi-perspective story clustering with bias transparency.

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16 with pgvector extension
- Redis 7

### Setup

```bash
# Install dependencies
npm install

# Copy env file and configure API keys
cp .env.example .env

# Start PostgreSQL and Redis (via Docker or locally)
docker compose up -d postgres redis

# Run database migrations
npm run migrate

# Seed news sources (28+ global outlets)
npm run seed:sources

# Start the API server
npm start

# Run a manual ingestion cycle
npm run ingest

# Start the automated scheduler (every 15 min)
npm run scheduler
```

### API Endpoints

All endpoints are prefixed with `/api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Database connectivity check |
| GET | `/headlines` | Paginated news feed with filters |
| GET | `/articles/:id` | Single article with source bias metadata |
| GET | `/sources` | All sources with 24h article counts |
| GET | `/stats/topics` | Topic distribution |
| GET | `/stats/regions` | Regional distribution |
| GET | `/stats/overview` | Combined dashboard stats |
| POST | `/admin/ingest` | Trigger manual ingestion |

### Query Parameters for `/headlines`

- `topic` — Filter by topic
- `region` — Filter by region (americas, europe, asia_pacific, mideast_africa)
- `language` — Filter by language code
- `since` — ISO datetime, only articles after this time
- `limit` — Results per page (1-100, default 20)
- `offset` — Pagination offset

## Architecture

- **Ingestion Pipeline**: RSS feeds + NewsAPI + GNews + Mediastack
- **Deduplication**: SimHash fingerprinting with Hamming distance
- **Bias Transparency**: 5-dimension framework (funding, editorial lean, factual rating, ownership, region)
- **Source Coverage**: 28+ outlets across 4 global regions
