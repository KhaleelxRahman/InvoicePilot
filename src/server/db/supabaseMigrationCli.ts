import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadAppConfig } from '../config.js';
import { buildPostgresSslConfig } from './postgresPoolAdapter.js';

const { Pool } = pg;

export async function runSupabaseMigration(databaseUrl?: string): Promise<{ success: boolean; appliedTables: string[] }> {
  const config = loadAppConfig();
  const url = databaseUrl || config.databaseUrl;

  if (!url || !url.startsWith('postgres')) {
    throw new Error(
      '[Supabase Migration] DATABASE_URL must be a PostgreSQL connection string. Migration was not applied.'
    );
  }

  const ssl = buildPostgresSslConfig(url);
  const pool = new Pool({
    connectionString: url,
    ...(ssl !== false ? { ssl } : {})
  });

  const client = await pool.connect();
  try {
    console.log('[Supabase Migration] Connected to PostgreSQL / Supabase.');
    await client.query('BEGIN');

    const migrations = [
      ['001_initial_supabase_schema.sql', 'initial schema and deterministic seed'],
      ['002_invoice_completed_flag.sql', 'is_completed flag'],
      ['003_add_refunded_provider_status.sql', 'refunded provider status constraint'],
      ['004_rate_limits.sql', 'distributed rate_limits table']
    ] as const;

    for (const [fileName, description] of migrations) {
      const migrationPath = path.resolve(process.cwd(), 'migrations', fileName);
      if (!fs.existsSync(migrationPath)) {
        throw new Error(`[Supabase Migration] Required migration is missing: ${fileName}`);
      }

      console.log(`[Supabase Migration] Applying ${fileName} (${description})...`);
      await client.query(fs.readFileSync(migrationPath, 'utf-8'));
    }

    await client.query(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES
        (2, '002_invoice_completed_flag', NOW()),
        (3, '003_add_refunded_provider_status', NOW())
      ON CONFLICT (version) DO NOTHING;
    `);

    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    const tableNames = res.rows.map((r: { table_name: string }) => r.table_name);
    await client.query('COMMIT');
    console.log(`[Supabase Migration] Successfully migrated ${tableNames.length} tables:`, tableNames.join(', '));

    return { success: true, appliedTables: tableNames };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original migration error if the connection is unavailable.
    }
    const message = err instanceof Error ? err.message : 'Unknown migration failure';
    console.error(`[Supabase Migration] Failed to apply migration: ${message}`);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.includes('supabaseMigrationCli')) {
  runSupabaseMigration()
    .then((res) => {
      if (res.success) {
        console.log('[Supabase Migration] Done.');
        process.exit(0);
      } else {
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
