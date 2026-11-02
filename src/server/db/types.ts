/**
 * Generic synchronous SQL database driver interface.
 * Implemented by both:
 * 1. Node.js native `DatabaseSync` (SQLite)
 * 2. `PostgresDatabaseSyncAdapter` (pg-mem / PostgreSQL test sandbox)
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

/**
 * Asynchronous SQL database driver interface.
 * Implemented by PostgresPoolAdapter (real Supabase PostgreSQL via pg.Pool).
 */
export interface IAsyncSqlStatement {
  get(...params: unknown[]): Promise<unknown>;
  all(...params: unknown[]): Promise<unknown[]>;
  run(...params: unknown[]): Promise<{ changes: number | bigint; lastInsertRowid?: number | bigint }>;
}

export interface IAsyncSqlDatabase {
  exec(sql: string): Promise<void>;
  prepare(sql: string): IAsyncSqlStatement;
  close?(): Promise<void>;
}
