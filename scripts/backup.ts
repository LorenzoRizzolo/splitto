// Usage: npm run backup
import {
	createBackup,
	createLogger,
	loadConfig,
	LocalFolderTarget,
	rotate,
	type BackupTarget
} from './lib/backup-core';

const cfg = loadConfig();
const log = createLogger(cfg.backupDir);

// Add remote targets here in the future (they receive the already-verified archive).
const targets: BackupTarget[] = [new LocalFolderTarget(cfg.backupDir)];

try {
	log.info(`Backup avviato (db: ${cfg.databasePath}, upload: ${cfg.uploadDir})`);
	const archive = await createBackup(cfg, log);
	for (const t of targets) {
		const where = await t.store(archive);
		log.info(`Salvato su ${t.name}: ${where}`);
		await rotate(t, cfg, log);
	}
	log.info(
		`Backup completato (conservati ${cfg.keepDaily} giornalieri e ${cfg.keepWeekly} settimanali)`
	);
} catch (err) {
	log.error(`Backup FALLITO: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
}
