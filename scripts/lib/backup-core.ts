import Database from 'better-sqlite3';
import { create as tarCreate, extract as tarExtract } from 'tar';
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
	copyFileSync,
	cpSync
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { backupName, selectBackupsToKeep } from './rotation';

export type BackupConfig = {
	databasePath: string;
	uploadDir: string;
	backupDir: string;
	keepDaily: number;
	keepWeekly: number;
};

export function loadConfig(): BackupConfig {
	const int = (v: string | undefined, d: number) =>
		Number.parseInt(v ?? '', 10) > 0 ? Number.parseInt(v!, 10) : d;
	return {
		databasePath: resolve(process.env.DATABASE_PATH || './data/splitto.db'),
		uploadDir: resolve(process.env.UPLOAD_DIR || './data/uploads'),
		backupDir: resolve(process.env.BACKUP_DIR || './backups'),
		keepDaily: int(process.env.BACKUP_KEEP_DAILY, 7),
		keepWeekly: int(process.env.BACKUP_KEEP_WEEKLY, 4)
	};
}

/**
 * Where finished archives are stored. Only a local folder today; implement this interface
 * (e.g. S3, rsync, Backblaze) and add it to `targets` in backup.ts to ship backups off-site.
 */
export interface BackupTarget {
	readonly name: string;
	/** Stores the archive (already verified) and returns where it went. */
	store(archivePath: string): Promise<string>;
	/** Lists stored archive names (for rotation). */
	list(): Promise<string[]>;
	/** Removes an archive by name. */
	remove(name: string): Promise<void>;
}

export class LocalFolderTarget implements BackupTarget {
	readonly name = 'locale';
	constructor(private dir: string) {
		mkdirSync(dir, { recursive: true });
	}
	async store(archivePath: string) {
		const dest = join(this.dir, basename(archivePath));
		if (resolve(archivePath) !== resolve(dest)) copyFileSync(archivePath, dest);
		return dest;
	}
	async list() {
		return readdirSync(this.dir).filter((f) => f.endsWith('.tar.gz'));
	}
	async remove(name: string) {
		rmSync(join(this.dir, basename(name)), { force: true });
	}
}

export function createLogger(backupDir: string) {
	mkdirSync(backupDir, { recursive: true });
	const file = join(backupDir, 'backup.log');
	const write = (level: 'INFO' | 'ERROR', msg: string) => {
		const line = `${new Date().toISOString()} [${level}] ${msg}`;
		(level === 'ERROR' ? console.error : console.log)(line);
		appendFileSync(file, line + '\n');
	};
	return { info: (m: string) => write('INFO', m), error: (m: string) => write('ERROR', m) };
}
export type Logger = ReturnType<typeof createLogger>;

export function integrityCheck(dbFile: string): string {
	const db = new Database(dbFile, { readonly: true, fileMustExist: true });
	try {
		const rows = db.pragma('integrity_check') as { integrity_check: string }[];
		return rows.map((r) => r.integrity_check).join('; ');
	} finally {
		db.close();
	}
}

/**
 * Creates a verified archive: online SQLite backup (safe with WAL and concurrent writers,
 * unlike a plain file copy) + the uploads folder, then gzip-tars them.
 */
export async function createBackup(
	cfg: BackupConfig,
	log: Logger,
	now = new Date()
): Promise<string> {
	if (!existsSync(cfg.databasePath)) throw new Error(`Database non trovato: ${cfg.databasePath}`);
	mkdirSync(cfg.backupDir, { recursive: true });
	const work = mkdtempSync(join(tmpdir(), 'splitto-backup-'));
	try {
		const snapshot = join(work, 'splitto.db');
		const source = new Database(cfg.databasePath, { fileMustExist: true });
		source.pragma('busy_timeout = 5000');
		try {
			await source.backup(snapshot);
		} finally {
			source.close();
		}
		const check = integrityCheck(snapshot);
		if (check !== 'ok') throw new Error(`Integrity check fallito sulla copia: ${check}`);
		log.info(
			`Copia del database verificata (integrity_check = ok, ${(statSync(snapshot).size / 1024).toFixed(0)} KB)`
		);

		const entries = ['splitto.db'];
		if (existsSync(cfg.uploadDir)) {
			cpSync(cfg.uploadDir, join(work, 'uploads'), { recursive: true });
			entries.push('uploads');
		}
		const archive = join(cfg.backupDir, backupName(now));
		await tarCreate({ gzip: true, file: archive, cwd: work, portable: true }, entries);
		log.info(`Archivio creato: ${archive} (${(statSync(archive).size / 1024).toFixed(0)} KB)`);
		return archive;
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

export async function rotate(target: BackupTarget, cfg: BackupConfig, log: Logger) {
	const names = await target.list();
	const keep = selectBackupsToKeep(names, cfg.keepDaily, cfg.keepWeekly);
	for (const name of names) {
		if (!keep.has(name) && /^splitto-.*\.tar\.gz$/.test(name)) {
			await target.remove(name);
			log.info(`Rotazione: eliminato ${name} (${target.name})`);
		}
	}
}

/** Extracts an archive into a fresh temp folder and verifies the database inside. */
export async function extractAndVerify(
	archive: string
): Promise<{ dir: string; db: string; uploads: string | null }> {
	const dir = mkdtempSync(join(tmpdir(), 'splitto-restore-'));
	await tarExtract({ file: archive, cwd: dir, strict: true });
	const db = join(dir, 'splitto.db');
	if (!existsSync(db)) throw new Error("L'archivio non contiene splitto.db");
	const check = integrityCheck(db);
	if (check !== 'ok') throw new Error(`Il database nel backup è danneggiato: ${check}`);
	const uploads = join(dir, 'uploads');
	return { dir, db, uploads: existsSync(uploads) ? uploads : null };
}
