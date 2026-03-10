# Global Pulse — Production Deployment Guide

> Save this file to your project root alongside `CLAUDE.md`.
> Work through the steps sequentially — each step depends on the previous ones.
> Start with: `"Deploy Global Pulse to production following DEPLOY.md, starting from Step 1."`

---

## Overview

Deploy Global Pulse from local Docker development to a production environment capable of serving real users. The target architecture is:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTION STACK                              │
│                                                                         │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │   Vercel     │    │   Railway     │    │   Railway (separate)     │   │
│  │  (Frontend)  │───▶│  (API Server) │    │  (Scheduler + Workers)   │   │
│  │  Next.js     │    │  Express      │    │  Cron + BullMQ           │   │
│  └─────────────┘    └──────┬───────┘    └────────────┬─────────────┘   │
│                             │                         │                 │
│                    ┌────────┴─────────────────────────┴──────┐         │
│                    │                                          │         │
│              ┌─────┴──────┐                        ┌─────────┴───┐    │
│              │  Supabase   │                        │   Upstash    │    │
│              │  Postgres   │                        │   Redis      │    │
│              │  + pgvector │                        │              │    │
│              └─────────────┘                        └──────────────┘    │
│                                                                         │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │  Sentry    │  │  UptimeRobot  │  │  Logtail    │  │  GitHub      │  │
│  │  (Errors)  │  │  (Uptime)     │  │  (Logs)     │  │  Actions     │  │
│  └───────────┘  └──────────────┘  └─────────────┘  │  (CI/CD)     │  │
│                                                      └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

Domain: globalpulse.dev (or your chosen domain)
API:    api.globalpulse.dev
App:    globalpulse.dev / www.globalpulse.dev
```

---

## Step 1 — Prepare the Codebase for Production

### 1.1 Environment Configuration

Create a `.env.production.example` with all required production variables:

```env
# ─── Database (Supabase) ───
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# ─── Redis (Upstash) ───
REDIS_URL=rediss://default:[password]@[endpoint].upstash.io:6379
UPSTASH_REDIS_REST_URL=https://[endpoint].upstash.io
UPSTASH_REDIS_REST_TOKEN=[token]

# ─── Claude API ───
ANTHROPIC_API_KEY=sk-ant-...

# ─── News APIs ───
NEWSDATA_API_KEY=pub_...
MEDIASTACK_API_KEY=...
GNEWS_API_KEY=...

# ─── Application ───
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://globalpulse.dev
API_URL=https://api.globalpulse.dev
CORS_ORIGIN=https://globalpulse.dev,https://www.globalpulse.dev

# ─── Monitoring ───
SENTRY_DSN=https://[key]@o[org].ingest.sentry.io/[project]
LOGTAIL_SOURCE_TOKEN=...

# ─── Rate Limiting ───
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ─── Scheduler ───
INGESTION_CRON=*/15 * * * *
INTELLIGENCE_CRON=*/20 * * * *
CLEANUP_CRON=0 3 * * *
```

### 1.2 Add Production Scripts to `package.json`

```json
{
  "scripts": {
    "start": "node src/index.js",
    "start:workers": "node src/workers/index.js",
    "start:scheduler": "node src/scheduler/index.js",
    "migrate:prod": "node src/db/migrate.js",
    "health": "curl -f http://localhost:${PORT:-3000}/api/health || exit 1",
    "build:frontend": "cd frontend && npm run build"
  }
}
```

### 1.3 Add Health Check Endpoint

Create `src/routes/health.js`:

```javascript
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { getRedisClient } from '../services/cache.js';

const router = Router();

router.get('/health', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {}
  };

  // Database check
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    checks.checks.database = { status: 'ok', latency: Date.now() - start };
  } catch (err) {
    checks.checks.database = { status: 'error', message: err.message };
    checks.status = 'degraded';
  }

  // Redis check
  try {
    const redis = getRedisClient();
    const start = Date.now();
    await redis.ping();
    checks.checks.redis = { status: 'ok', latency: Date.now() - start };
  } catch (err) {
    checks.checks.redis = { status: 'error', message: err.message };
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(checks);
});

router.get('/health/ready', async (req, res) => {
  // Readiness probe — only returns 200 when fully ready to serve traffic
  try {
    await pool.query('SELECT 1');
    const redis = getRedisClient();
    await redis.ping();
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

export default router;
```

### 1.4 Production Hardening in `src/index.js`

Add/verify these middleware:

```javascript
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Security headers
app.use(helmet());

// Gzip compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// CORS — restrict in production
import cors from 'cors';
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
  credentials: true
}));

// Trust proxy (Railway/Vercel)
app.set('trust proxy', 1);
```

### 1.5 Graceful Shutdown

Add to `src/index.js`:

```javascript
const signals = ['SIGTERM', 'SIGINT'];
signals.forEach(signal => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new requests
    server.close(() => {
      console.log('HTTP server closed');
    });

    // Close database pool
    try {
      await pool.end();
      console.log('Database pool closed');
    } catch (err) {
      console.error('Error closing database pool:', err);
    }

    // Close Redis
    try {
      const redis = getRedisClient();
      await redis.quit();
      console.log('Redis connection closed');
    } catch (err) {
      console.error('Error closing Redis:', err);
    }

    process.exit(0);
  });
});
```

### 1.6 Install Production Dependencies

```bash
npm install helmet compression express-rate-limit
npm install --save-dev @sentry/node  # if using Sentry
```

**Checkpoint:** Run locally with `NODE_ENV=production npm start` and verify `/api/health` returns `200`.

---

## Step 2 — Database Setup (Supabase)

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region close to your Railway deployment (e.g., `us-east-1`)
3. Set a strong database password — save it securely
4. Wait for project to finish provisioning

### 2.2 Enable pgvector Extension

In Supabase SQL Editor, run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.3 Run Migrations

Copy your `DATABASE_URL` from Supabase → Settings → Database → Connection String (use the "Connection pooling" string for the app, "Direct" for migrations).

```bash
# Run migrations against Supabase
DIRECT_DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  npm run migrate:prod
```

### 2.4 Verify Schema

```sql
-- In Supabase SQL Editor, verify tables exist:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected: articles, article_topics, clusters, cluster_articles,
-- cluster_framings, pending_sources, sources, etc.

-- Verify pgvector column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'articles' AND column_name = 'embedding';
```

### 2.5 Seed Sources

```bash
DATABASE_URL="postgresql://..." npm run seed:sources
```

### 2.6 Connection Pooling

Supabase provides PgBouncer by default on port 6543. Use this for your app's `DATABASE_URL`. Use the direct connection (port 5432) only for migrations.

**Checkpoint:** Connect to Supabase from your local machine using the production `DATABASE_URL` and verify `SELECT count(*) FROM sources` returns your seeded sources.

---

## Step 3 — Redis Setup (Upstash)

### 3.1 Create Upstash Redis Database

1. Go to [upstash.com](https://upstash.com) → Create Database
2. Choose the same region as your Supabase project
3. Select "TLS" (required for production)
4. Choose the free tier to start (10k commands/day)

### 3.2 Get Connection Details

From the Upstash dashboard, copy:
- `REDIS_URL` (starts with `rediss://` — note the double `s` for TLS)
- `UPSTASH_REDIS_REST_URL` (for REST API access if needed)
- `UPSTASH_REDIS_REST_TOKEN`

### 3.3 Update Redis Client for TLS

Verify your `src/services/cache.js` handles the `rediss://` protocol:

```javascript
import { createClient } from 'redis';

const getRedisClient = () => {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: process.env.REDIS_URL?.startsWith('rediss://'),
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Max retries reached');
          return Math.min(retries * 100, 3000);
        }
      }
    });

    client.on('error', (err) => console.error('Redis Client Error:', err));
    client.on('connect', () => console.log('Redis connected'));
    client.on('reconnecting', () => console.log('Redis reconnecting...'));
  }
  return client;
};
```

**Checkpoint:** Set `REDIS_URL` to your Upstash URL locally and verify the health check shows Redis as `ok`.

---

## Step 4 — Backend Deployment (Railway)

### 4.1 Create Railway Project

1. Go to [railway.app](https://railway.app) → New Project
2. Choose "Deploy from GitHub repo"
3. Connect your GitHub account and select the `global-pulse` repo
4. Railway will auto-detect Node.js

### 4.2 Configure API Service

In Railway dashboard → Service Settings:

```
Name: global-pulse-api
Root Directory: /          (or wherever package.json lives)
Build Command: npm install
Start Command: npm start
Watch Paths: src/**
```

### 4.3 Set Environment Variables

In Railway → Variables, add ALL variables from `.env.production.example`:

```
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://globalpulse.dev
API_URL=https://api.globalpulse.dev
CORS_ORIGIN=https://globalpulse.dev,https://www.globalpulse.dev
# ... all other vars
```

### 4.4 Create Scheduler/Worker Service

Create a second Railway service in the same project:

```
Name: global-pulse-scheduler
Root Directory: /
Build Command: npm install
Start Command: npm run scheduler
```

Share the same environment variables (Railway supports shared variable groups).

### 4.5 Custom Domain

In Railway → Service → Settings → Networking:
1. Add custom domain: `api.globalpulse.dev`
2. Railway will provide a CNAME record
3. Add this CNAME to your DNS provider

### 4.6 Railway Configuration File

Create `railway.toml` in project root:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install --production=false && cd frontend && npm install && cd .."

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[service]
internalPort = 3000
```

**Checkpoint:** Deploy to Railway and verify `https://api.globalpulse.dev/api/health` returns `200` with all checks passing.

---

## Step 5 — Frontend Deployment (Vercel)

### 5.1 Create Vercel Project

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Set the root directory to `frontend`

### 5.2 Configure Build Settings

```
Framework Preset: Next.js
Root Directory: frontend
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 5.3 Environment Variables

```
NEXT_PUBLIC_API_URL=https://api.globalpulse.dev
NEXT_PUBLIC_APP_URL=https://globalpulse.dev
```

### 5.4 Custom Domain

In Vercel → Project → Settings → Domains:
1. Add `globalpulse.dev`
2. Add `www.globalpulse.dev`
3. Vercel will provide DNS records (A record + CNAME)

### 5.5 Vercel Configuration

Create `frontend/vercel.json`:

```json
{
  "framework": "nextjs",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.globalpulse.dev/api/:path*"
    }
  ]
}
```

### 5.6 Update Frontend API Configuration

Ensure the frontend uses the environment variable for API calls:

```typescript
// frontend/src/lib/api.ts or similar
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

**Checkpoint:** Deploy to Vercel and verify:
- `https://globalpulse.dev` loads the frontend
- API calls from the frontend reach the Railway backend
- No CORS errors in browser console

---

## Step 6 — CI/CD Pipeline (GitHub Actions)

### 6.1 Create Workflow File

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Global Pulse

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  # ─── Lint & Type Check ───
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install backend dependencies
        run: npm ci

      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Lint frontend
        run: cd frontend && npm run lint

      - name: Type check frontend
        run: cd frontend && npx tsc --noEmit

  # ─── Test ───
  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: globalpulse_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/globalpulse_test
        run: npm run migrate

      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/globalpulse_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test
        run: npm test

  # ─── Build Frontend ───
  build-frontend:
    name: Build Frontend
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Build
        env:
          NEXT_PUBLIC_API_URL: https://api.globalpulse.dev
        run: cd frontend && npm run build

  # ─── Deploy (only on push to main) ───
  deploy-backend:
    name: Deploy Backend
    runs-on: ubuntu-latest
    needs: [test, build-frontend]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: railwayapp/railway-deploy@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: global-pulse-api

  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    needs: [test, build-frontend]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      # Vercel deploys automatically via GitHub integration
      # This step just verifies the deployment
      - name: Wait for Vercel deployment
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          environment: Production
```

### 6.2 Add GitHub Secrets

In GitHub → Settings → Secrets → Actions:

```
RAILWAY_TOKEN        → From Railway → Account → API Tokens
ANTHROPIC_API_KEY    → Your Claude API key (for tests if needed)
DATABASE_URL         → Test database URL (for CI tests)
```

### 6.3 Add Branch Protection

In GitHub → Settings → Branches → Add rule for `main`:
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass (select: `quality`, `test`, `build-frontend`)
- ✅ Require branches to be up to date before merging

**Checkpoint:** Create a PR with a small change and verify all checks pass. Merge and verify auto-deployment.

---

## Step 7 — Monitoring & Observability

### 7.1 Sentry Error Tracking

Install and configure Sentry:

```bash
npm install @sentry/node
```

Add to `src/index.js` (at the very top, before other imports):

```javascript
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% of transactions
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
    ],
  });

  // Request handler must be the first middleware
  app.use(Sentry.Handlers.requestHandler());

  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

// ... your routes ...

// Error handler must be before any other error middleware
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}
```

### 7.2 Structured Logging

Create `src/utils/logger.js`:

```javascript
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] > currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
    service: process.env.SERVICE_NAME || 'global-pulse-api',
    environment: process.env.NODE_ENV,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
```

### 7.3 UptimeRobot

1. Create account at [uptimerobot.com](https://uptimerobot.com)
2. Add monitors:
   - **API Health**: `https://api.globalpulse.dev/api/health` (5-min interval, keyword: `"status":"ok"`)
   - **Frontend**: `https://globalpulse.dev` (5-min interval, HTTP 200)
3. Set up alert contacts (email, Slack webhook, etc.)

### 7.4 Create Status Dashboard

Add a simple status page endpoint to `src/routes/health.js`:

```javascript
router.get('/health/metrics', async (req, res) => {
  const metrics = {
    articles: await pool.query('SELECT count(*) FROM articles').then(r => r.rows[0].count),
    clusters: await pool.query('SELECT count(*) FROM clusters WHERE archived_at IS NULL').then(r => r.rows[0].count),
    sources: await pool.query('SELECT count(*) FROM sources WHERE active = true').then(r => r.rows[0].count),
    lastIngestion: await pool.query('SELECT max(created_at) FROM articles').then(r => r.rows[0].max),
    lastClustering: await pool.query('SELECT max(updated_at) FROM clusters').then(r => r.rows[0].max),
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
  };
  res.json(metrics);
});
```

**Checkpoint:** Verify Sentry captures a test error, UptimeRobot shows "Up", and structured logs appear in Railway's log viewer.

---

## Step 8 — DNS & Domain Configuration

### 8.1 Purchase/Configure Domain

If using `globalpulse.dev`:

1. Register at your preferred registrar (Cloudflare, Namecheap, etc.)
2. If using Cloudflare, enable their DNS proxy for DDoS protection

### 8.2 DNS Records

```
Type    Name    Value                               TTL
─────   ─────   ──────────────────────────────────  ────
A       @       76.76.21.21 (Vercel)               Auto
CNAME   www     cname.vercel-dns.com               Auto
CNAME   api     [your-service].up.railway.app       Auto
```

### 8.3 SSL/TLS

- **Vercel**: Automatically provisions SSL certificates via Let's Encrypt
- **Railway**: Automatically provisions SSL for custom domains
- **Verify**: Both `https://globalpulse.dev` and `https://api.globalpulse.dev` show valid certificates

### 8.4 Redirect Rules

In Vercel, `www.globalpulse.dev` → `globalpulse.dev` (or vice versa):

```json
// frontend/vercel.json — add to existing config
{
  "redirects": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "www.globalpulse.dev" }],
      "destination": "https://globalpulse.dev/:path*",
      "permanent": true
    }
  ]
}
```

**Checkpoint:** All domains resolve correctly:
- `https://globalpulse.dev` → Vercel (frontend)
- `https://www.globalpulse.dev` → redirects to `globalpulse.dev`
- `https://api.globalpulse.dev` → Railway (backend)
- All have valid SSL certificates

---

## Post-Launch Checklist

### Security
- [ ] All API keys are in environment variables, not in code
- [ ] CORS is restricted to production domains only
- [ ] Rate limiting is active on all API routes
- [ ] Helmet.js security headers are set
- [ ] Database credentials use connection pooling
- [ ] Redis uses TLS (`rediss://`)
- [ ] No sensitive data in logs
- [ ] `.env` is in `.gitignore`

### Performance
- [ ] Database has proper indexes (check with `EXPLAIN ANALYZE`)
- [ ] Redis caching is working (check cache hit rates)
- [ ] Frontend is using Next.js static generation where possible
- [ ] Images are optimized (Next.js Image component)
- [ ] API responses are compressed (gzip)

### Reliability
- [ ] Health checks are passing
- [ ] Graceful shutdown is implemented
- [ ] Error tracking (Sentry) is capturing errors
- [ ] Uptime monitoring is configured
- [ ] Database backups are enabled (Supabase does this automatically)
- [ ] Scheduler is running on its own service (won't crash the API)

### Monitoring
- [ ] UptimeRobot alerts are configured
- [ ] Sentry alerts for new errors
- [ ] Railway metrics dashboard reviewed
- [ ] Supabase database metrics reviewed
- [ ] Upstash Redis metrics reviewed

### DNS & SSL
- [ ] All domains resolve correctly
- [ ] SSL certificates are valid
- [ ] www redirects to apex (or vice versa)
- [ ] API subdomain is configured

---

## Estimated Costs (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Supabase | Free (500MB DB) | $0 |
| Upstash Redis | Free (10k/day) | $0 |
| Railway | Hobby ($5 credit) | ~$5 |
| Vercel | Hobby (free) | $0 |
| Domain | .dev | ~$12/year |
| Sentry | Free (5k events) | $0 |
| UptimeRobot | Free (50 monitors) | $0 |
| Claude API | Pay-as-you-go | ~$10-30 |
| **Total** | | **~$20-40/mo** |

> Scale up: Supabase Pro ($25/mo), Railway Pro ($20/mo), Upstash Pay-as-you-go ($0.2/100k commands) when you need more capacity.

---

## Rollback Procedure

If a deployment causes issues:

### Railway (Backend)
```bash
# Railway keeps deployment history — rollback via dashboard
# Or use CLI:
railway up --detach  # deploy specific commit
```

### Vercel (Frontend)
```bash
# Vercel keeps deployment history — rollback via dashboard
# Settings → Deployments → find last working → "..." → Promote to Production
```

### Database
```bash
# Supabase has point-in-time recovery (Pro plan)
# For free tier, maintain manual backups:
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## Quick Reference Commands

```bash
# Check production health
curl https://api.globalpulse.dev/api/health | jq .

# Check metrics
curl https://api.globalpulse.dev/api/health/metrics | jq .

# View Railway logs
railway logs --service global-pulse-api

# View Vercel logs
vercel logs globalpulse.dev

# Connect to production database (careful!)
psql $DATABASE_URL

# Run production migration
DIRECT_DATABASE_URL="..." npm run migrate:prod

# Manual ingestion (if scheduler fails)
railway run npm run ingest

# Manual intelligence processing
railway run npm run intelligence
```
