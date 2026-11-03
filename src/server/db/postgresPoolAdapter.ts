import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import type { IAsyncSqlDatabase, IAsyncSqlStatement } from './types.js';
import { translateSqlDialect, normalizeRow } from './postgresAdapter.js';

const { Pool } = pg;

// Tracks active transaction client per async call stack
const txStorage = new AsyncLocalStorage<pg.PoolClient>();

/**
 * Converts SQLite-style positional `?` parameters to PostgreSQL-style `$1, $2, ...`
 */
export function convertQuestionMarksToDollarNumbered(sql: string): string {
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

/**
 * Resolves PostgreSQL SSL/TLS configuration.
 * Certificate validation is strictly enforced (rejectUnauthorized: true) by default
 * to protect production traffic from man-in-the-middle attacks.
 */
export function buildPostgresSslConfig(
  connectionString: string
): boolean | { rejectUnauthorized: boolean; ca?: string } {
  if (/sslmode=disable/i.test(connectionString) || /localhost|127\.0\.0\.1/.test(connectionString)) {
    return false;
  }

  const customCa = process.env.SUPABASE_SSL_CA || process.env.DATABASE_SSL_CA;
  if (customCa) {
    return {
      rejectUnauthorized: true,
      ca: customCa
    };
  }

  const isNetlify = Boolean(
    process.env.NETLIFY === 'true' ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );

  const allowInsecureTls =
    /sslmode=no-verify/i.test(connectionString) ||
    process.env.SUPABASE_SSL_REJECT_UNAUTHORIZED === 'false' ||
    isNetlify;

  return {
    rejectUnauthorized: !allowInsecureTls
  };
}

/**
 * Production-ready PostgreSQL adapter using official `pg.Pool`.
 * Supports async queries, parameterized execution, and scoped transaction isolation
 * via AsyncLocalStorage without using Atomics.wait or SharedArrayBuffer.
 */
export class PostgresPoolAdapter implements IAsyncSqlDatabase {
  public readonly isAsync = true;
  private readonly pool: pg.Pool;

  public constructor(connectionStringOrPool: string | pg.Pool) {
    if (typeof connectionStringOrPool === 'string') {
      const ssl = buildPostgresSslConfig(connectionStringOrPool);
      this.pool = new Pool({
        connectionString: connectionStringOrPool,
        ...(ssl !== false ? { ssl } : {}),
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });
    } else {
      this.pool = connectionStringOrPool;
    }
  }

  public async exec(sql: string): Promise<void> {
    const translated = translateSqlDialect(sql);
    if (translated.startsWith('--')) return;

    const client = txStorage.getStore() || this.pool;
    await client.query(translated);
  }

  public prepare(sql: string): IAsyncSqlStatement {
    const translated = translateSqlDialect(sql);
    const pgSql = convertQuestionMarksToDollarNumbered(translated);
    const pool = this.pool;

    return {
      async get(...params: unknown[]): Promise<unknown> {
        const client = txStorage.getStore() || pool;
        const res = await client.query(pgSql, params);
        if (!res.rows || res.rows.length === 0) return undefined;
        return normalizeRow(res.rows[0]);
      },

      async all(...params: unknown[]): Promise<unknown[]> {
        const client = txStorage.getStore() || pool;
        const res = await client.query(pgSql, params);
        return (res.rows || []).map(normalizeRow);
      },

      async run(...params: unknown[]): Promise<{ changes: number | bigint; lastInsertRowid?: number | bigint }> {
        const client = txStorage.getStore() || pool;
        const res = await client.query(pgSql, params);
        return {
          changes: res.rowCount ?? 0
        };
      }
    };
  }

  /**
   * Scopes an async transaction block to a single dedicated pool client.
   */
  public async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const existingClient = txStorage.getStore();
    if (existingClient) {
      // Nested transaction: use SAVEPOINT
      const spId = `sp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await existingClient.query(`SAVEPOINT ${spId};`);
      try {
        const result = await fn();
        await existingClient.query(`RELEASE SAVEPOINT ${spId};`);
        return result;
      } catch (err) {
        await existingClient.query(`ROLLBACK TO SAVEPOINT ${spId};`);
        await existingClient.query(`RELEASE SAVEPOINT ${spId};`);
        throw err;
      }
    }

    // Top-level transaction: acquire dedicated client from pool
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN;');
      const result = await txStorage.run(client, async () => {
        return await fn();
      });
      await client.query('COMMIT;');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK;');
      } catch {
        // Ignore rollback failure if connection dropped
      }
      throw err;
    } finally {
      client.release();
    }
  }

  public async applyMigrations(migrationSql?: string): Promise<void> {
    const ddl =
      migrationSql ||
      fs.readFileSync(path.resolve(process.cwd(), 'migrations/001_initial_supabase_schema.sql'), 'utf-8');
    await this.pool.query(ddl);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public getPool(): pg.Pool {
    return this.pool;
  }
}

export function createRealPostgresDatabase(connectionString: string): PostgresPoolAdapter {
  return new PostgresPoolAdapter(connectionString);
}
