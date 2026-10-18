// Backup rotation: keep the newest backup of each of the last N days and of the last M ISO weeks.

const NAME = /^splitto-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.tar\.gz$/;

export function parseBackupName(name: string): Date | null {
	const m = NAME.exec(name);
	if (!m) return null;
	const [, y, mo, d, h, mi, s] = m.map(Number) as number[];
	return new Date(y!, mo! - 1, d!, h!, mi!, s!);
}

export function backupName(date: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `splitto-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}.tar.gz`;
}

function dayKey(d: Date) {
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** ISO-8601 week key, e.g. "2026-W42". */
export function isoWeekKey(d: Date): string {
	const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const day = date.getUTCDay() || 7;
	date.setUTCDate(date.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Returns the backup file names to keep; everything else (matching the pattern) can be deleted. */
export function selectBackupsToKeep(
	names: string[],
	keepDaily: number,
	keepWeekly: number
): Set<string> {
	const backups = names
		.map((name) => ({ name, date: parseBackupName(name) }))
		.filter((b): b is { name: string; date: Date } => b.date !== null)
		.sort((a, b) => b.date.getTime() - a.date.getTime());

	const keep = new Set<string>();
	const days = new Set<string>();
	const weeks = new Set<string>();
	for (const b of backups) {
		const day = dayKey(b.date);
		if (!days.has(day) && days.size < keepDaily) {
			days.add(day);
			keep.add(b.name);
		}
	}
	for (const b of backups) {
		const week = isoWeekKey(b.date);
		if (!weeks.has(week) && weeks.size < keepWeekly) {
			weeks.add(week);
			keep.add(b.name);
		}
	}
	return keep;
}
