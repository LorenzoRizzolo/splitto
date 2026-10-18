import { openDatabase, runMigrations, DEFAULT_DATABASE_PATH } from '../src/lib/server/db/client';

const path = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
const db = openDatabase(path);
runMigrations(db);
db.$client.close();
console.log(`✔ Migrazioni applicate a ${path}`);
