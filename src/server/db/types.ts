/**
 * Generic synchronous SQL database driver interface.
 * Implemented by both:
 * 1. Node.js native `DatabaseSync` (SQLite)
 * 2. `PostgresDatabaseSyncAdapter` (PostgreSQL / Supabase)
 */

export interface ISqlStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid?: number | bigint };
}

export interface ISqlDatabase {
  exec(sql: string): void;
  prepare(sql: string): ISqlStatement;
  close?(): void;
}
