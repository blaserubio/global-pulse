import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://globalpulse:globalpulse@localhost:5432/globalpulse',
  });

  await client.connect();
  console.log('Connected to database');

  // Ensure migrations tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get applied migrations
  const { rows: applied } = await client.query('SELECT name FROM _migrations ORDER BY id');
  const appliedNames = new Set(applied.map((r) => r.name));

  // Get migration files
  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`  Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`  Applying ${file}...`);
    const sql = readFileSync(join(__dirname, file), 'utf-8');

    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`  Applied ${file}`);
    } catch (err) {
      console.error(`  Failed to apply ${file}:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  console.log('All migrations applied');
  await client.end();
}

runMigrations().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
