// Usage: npm run restore -- backups/splitto-2026-10-18_03-00-00.tar.gz [--yes]
import Database from 'better-sqlite3';
import { createInterface } from 'node:readline/promises';
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createBackup, createLogger, extractAndVerify, loadConfig } from './lib/backup-core';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const yes = args.includes('--yes');
const cfg = loadConfig();
const log = createLogger(cfg.backupDir);

if (!file || !existsSync(file)) {
	console.error('Uso: npm run restore -- <file .tar.gz> [--yes]');
	process.exit(1);
}

/** Detects a running app: an HTTP server on PORT, or a lock held on the database. */
async function appLooksRunning(): Promise<string | null> {
	const port = process.env.PORT || '3000';
	for (const host of ['127.0.0.1', '[::1]']) {
		try {
			await fetch(`http://${host}:${port}/`, { signal: AbortSignal.timeout(1500) });
			return `risponde un server sulla porta ${port}`;
		} catch {
			/* nothing listening on this address */
		}
	}
	if (existsSync(cfg.databasePath)) {
		const db = new Database(cfg.databasePath);
		try {
			db.pragma('busy_timeout = 0');
			db.exec('BEGIN EXCLUSIVE; ROLLBACK;');
		} catch {
			return 'il database è bloccato da un altro processo';
		} finally {
			db.close();
		}
	}
	return null;
}

if (!yes && !process.stdin.isTTY) {
	console.error('Modalità non interattiva: aggiungi --yes per confermare il ripristino.');
	process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
async function confirm(question: string) {
	if (yes) return true;
	const answer = (await rl.question(`${question} [s/N] `)).trim().toLowerCase();
	return answer === 's' || answer === 'si' || answer === 'sì' || answer === 'y';
}

try {
	const running = await appLooksRunning();
	if (running) {
		console.warn(`⚠ Sembra che Splitto sia in esecuzione (${running}).`);
		console.warn(
			'  Fermalo prima del ripristino (es. sudo systemctl stop splitto) per evitare dati incoerenti.'
		);
		if (!(await confirm('Continuare comunque?'))) process.exit(1);
	}
	if (
		!(await confirm(`Ripristinare ${file}? Il database e gli upload attuali verranno sostituiti.`))
	) {
		console.log('Annullato.');
		process.exit(0);
	}

	log.info(`Ripristino da ${resolve(file)}: verifica dell'archivio…`);
	const extracted = await extractAndVerify(file);

	if (existsSync(cfg.databasePath)) {
		const safety = await createBackup(cfg, log);
		log.info(`Backup di sicurezza dello stato attuale: ${safety}`);
	}

	mkdirSync(dirname(cfg.databasePath), { recursive: true });
	for (const suffix of ['-wal', '-shm']) rmSync(cfg.databasePath + suffix, { force: true });
	copyFileSync(extracted.db, cfg.databasePath);

	if (extracted.uploads) {
		const old = `${cfg.uploadDir}.old-${Date.now()}`;
		if (existsSync(cfg.uploadDir)) renameSync(cfg.uploadDir, old);
		cpSync(extracted.uploads, cfg.uploadDir, { recursive: true });
		rmSync(old, { recursive: true, force: true });
	}
	rmSync(extracted.dir, { recursive: true, force: true });
	log.info('Ripristino completato. Riavvia Splitto.');
} catch (err) {
	log.error(`Ripristino FALLITO: ${err instanceof Error ? err.message : String(err)}`);
	process.exitCode = 1;
} finally {
	rl.close();
}
