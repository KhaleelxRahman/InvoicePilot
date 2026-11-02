import fs from 'node:fs';
import path from 'node:path';
import { newDb, DataType, type IMemoryDb } from 'pg-mem';
import type { ISqlDatabase, ISqlStatement } from './types.js';

/**
 * Normalizes query result rows:
 * Converts any Date objects into ISO-8601 strings to maintain
 * exact parity with SQLite string timestamp representation.
 */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== 'object') return row;
  const normalized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val instanceof Date) {
      if (key.endsWith('_date') || key === 'issue_date' || key === 'due_date') {
        normalized[key] = val.toISOString().slice(0, 10);
      } else {
        normalized[key] = val.toISOString();
      }
    } else {
      normalized[key] = val;
    }
  }
  return normalized;
}

/**
 * Safely escapes literals for SQL queries against PostgreSQL.
 */
export function escapePgLiteral(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) throw new Error(`Invalid non-finite number: ${val}`);
    return String(val);
  }
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Inlines positional '?' parameters into a valid PostgreSQL SQL string.
 */
export function inlineParams(sql: string, params: unknown[]): string {
  let paramIndex = 0;
  return sql.replace(/\?/g, () => {
    if (paramIndex >= params.length) {
      throw new Error(`Insufficient parameters supplied for SQL query: expected > ${paramIndex}, got ${params.length}`);
    }
    return escapePgLiteral(params[paramIndex++]);
  });
}

/**
 * Translates SQLite-specific dialect into PostgreSQL dialect.
 */
export function translateSqlDialect(sql: string): string {
  let translated = sql.trim();

  // SQLite PRAGMAs are no-ops in PostgreSQL
  if (/^PRAGMA\s+/i.test(translated)) {
    return '-- pragma ignored in postgres';
  }

  // SQLite BEGIN IMMEDIATE -> PostgreSQL BEGIN
  translated = translated.replace(/BEGIN\s+IMMEDIATE\s+TRANSACTION;?/i, 'BEGIN;');

  return translated;
}

export class PostgresDatabaseSyncAdapter implements ISqlDatabase {
  private readonly txStack: Array<ReturnType<IMemoryDb['backup']>> = [];
  private readonly savepoints = new Map<string, ReturnType<IMemoryDb['backup']>>();

  public constructor(private readonly memDb: IMemoryDb) {}

  public exec(sql: string): void {
    const translated = translateSqlDialect(sql);
    if (translated.startsWith('--')) return;

    if (/^BEGIN/i.test(translated)) {
      this.txStack.push(this.memDb.backup());
      return;
    }

    if (/^COMMIT/i.test(translated)) {
      this.txStack.pop();
      return;
    }

    if (/^ROLLBACK;/i.test(translated)) {
      const snap = this.txStack.pop();
      if (snap) {
        snap.restore();
      }
      return;
    }

    const savepointMatch = translated.match(/^SAVEPOINT\s+([a-zA-Z0-9_]+)/i);
    if (savepointMatch) {
      const name = savepointMatch[1];
      this.savepoints.set(name, this.memDb.backup());
      return;
    }

    const rollbackSavepointMatch = translated.match(/^ROLLBACK\s+TO\s+SAVEPOINT\s+([a-zA-Z0-9_]+)/i);
    if (rollbackSavepointMatch) {
      const name = rollbackSavepointMatch[1];
      const snap = this.savepoints.get(name);
      if (snap) {
        snap.restore();
      }
      return;
    }

    const releaseSavepointMatch = translated.match(/^RELEASE\s+SAVEPOINT\s+([a-zA-Z0-9_]+)/i);
    if (releaseSavepointMatch) {
      const name = releaseSavepointMatch[1];
      this.savepoints.delete(name);
      return;
    }

    this.memDb.public.query(translated);
  }

  public close(): void {
    // In-memory PostgreSQL instance release
  }

  public prepare(sql: string): ISqlStatement {
    const dialectSql = translateSqlDialect(sql);

    return {
      get: (...params: unknown[]) => {
        const queryWithParams = inlineParams(dialectSql, params);
        const res = this.memDb.public.query(queryWithParams);
        const first = res.rows[0];
        return first ? normalizeRow(first as Record<string, unknown>) : undefined;
      },
      all: (...params: unknown[]) => {
        const queryWithParams = inlineParams(dialectSql, params);
        const res = this.memDb.public.query(queryWithParams);
        return res.rows.map((r) => normalizeRow(r as Record<string, unknown>));
      },
      run: (...params: unknown[]) => {
        const queryWithParams = inlineParams(dialectSql, params);
        const res = this.memDb.public.query(queryWithParams);
        return { changes: res.rowCount ?? 0 };
      }
    };
  }
}

/**
 * Creates and initializes an isolated in-memory PostgreSQL database,
 * applies the exact Supabase migration DDL, and returns an ISqlDatabase adapter.
 */
export function createIsolatedPostgresDatabase(): PostgresDatabaseSyncAdapter {
  const db = newDb();

  // Register native SQL functions required by schema
  db.public.registerFunction({
    name: 'length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (str: string) => (str ? str.length : 0)
  });

  // Apply complete Supabase PostgreSQL schema migration 001
  const sqlPath = path.resolve(process.cwd(), 'migrations/001_initial_supabase_schema.sql');
  const ddl = fs.readFileSync(sqlPath, 'utf-8');
  db.public.query(ddl);

  return new PostgresDatabaseSyncAdapter(db);
}
