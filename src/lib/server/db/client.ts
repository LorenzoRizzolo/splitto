import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export const DEFAULT_DATABASE_PATH = './data/splitto.db';
export const MIGRATIONS_FOLDER = './drizzle';

/** Opens the SQLite file with the pragmas required by the app (WAL, FKs, busy timeout). */
export function openDatabase(path: string = DEFAULT_DATABASE_PATH): DB {
	if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	sqlite.pragma('synchronous = NORMAL');
	return drizzle(sqlite, { schema }) as DB;
}

export function runMigrations(db: DB, migrationsFolder: string = MIGRATIONS_FOLDER) {
	migrate(db, { migrationsFolder });
}

/** A database handle or a transaction (both share the query builder API). */
export type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];
