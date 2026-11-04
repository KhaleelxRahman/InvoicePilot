import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadAppConfig } from '../config.js';

const { Pool } = pg;

export async function runSupabaseMigration(databaseUrl?: string): Promise<{ success: boolean; appliedTables: string[] }> {
  const config = loadAppConfig();
  const url = databaseUrl || config.databaseUrl;

  if (!url || !url.startsWith('postgres')) {
    console.warn(`[Supabase Migration] DATABASE_URL is not a PostgreSQL connection string ("${url}"). Skipping remote migration.`);
    return { success: false, appliedTables: [] };
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('[Supabase Migration] Connected to PostgreSQL / Supabase.');
    const sqlPath = path.resolve(process.cwd(), 'migrations/001_initial_supabase_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('[Supabase Migration] Applying initial schema and deterministic seed...');
    await client.query(sql);

    const sqlPath2 = path.resolve(process.cwd(), 'migrations/002_invoice_completed_flag.sql');
    if (fs.existsSync(sqlPath2)) {
      console.log('[Supabase Migration] Applying Migration 002 (is_completed flag)...');
      const sql2 = fs.readFileSync(sqlPath2, 'utf-8');
      await client.query(sql2);
    }

    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    const tableNames = res.rows.map((r: { table_name: string }) => r.table_name);
    console.log(`[Supabase Migration] Successfully migrated ${tableNames.length} tables:`, tableNames.join(', '));

    return { success: true, appliedTables: tableNames };
  } catch (err) {
    console.error('[Supabase Migration] Failed to apply migration:', err);
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
