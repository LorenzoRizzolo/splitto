import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { openDatabase, runMigrations, DEFAULT_DATABASE_PATH, type DB } from './client';

function init(): DB {
	const db = openDatabase(env.DATABASE_PATH || DEFAULT_DATABASE_PATH);
	if (env.DB_AUTO_MIGRATE !== 'false') runMigrations(db);
	return db;
}

// Lazily opened so that `vite build` (prerender/analyse) never touches the database file.
let instance: DB | undefined;
export const db: DB = new Proxy({} as DB, {
	get(_target, prop, receiver) {
		if (building) throw new Error('Database is not available during build');
		instance ??= init();
		return Reflect.get(instance, prop, receiver);
	}
});

export * as schema from './schema';
