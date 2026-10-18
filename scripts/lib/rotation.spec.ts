import { describe, expect, it } from 'vitest';
import { backupName, isoWeekKey, parseBackupName, selectBackupsToKeep } from './rotation';

describe('backup rotation', () => {
	it('round-trips names', () => {
		const d = new Date(2026, 9, 18, 3, 4, 5);
		expect(backupName(d)).toBe('splitto-2026-10-18_03-04-05.tar.gz');
		expect(parseBackupName(backupName(d))?.getTime()).toBe(d.getTime());
		expect(parseBackupName('other.tar.gz')).toBeNull();
	});

	it('computes ISO weeks', () => {
		expect(isoWeekKey(new Date(2026, 0, 1))).toBe('2026-W01');
		expect(isoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53');
	});

	it('keeps the newest backup per day for N days and per week for M weeks', () => {
		const names: string[] = [];
		// Two backups a day for 60 days.
		for (let i = 0; i < 60; i++) {
			names.push(backupName(new Date(2026, 9, 18 - i, 3, 0, 0)));
			names.push(backupName(new Date(2026, 9, 18 - i, 15, 0, 0)));
		}
		const keep = selectBackupsToKeep(names, 7, 4);
		// 7 daily (the 15:00 ones) + weekly picks that are not already among them.
		for (let i = 0; i < 7; i++)
			expect(keep.has(backupName(new Date(2026, 9, 18 - i, 15, 0, 0)))).toBe(true);
		expect(keep.has(backupName(new Date(2026, 9, 18, 3, 0, 0)))).toBe(false);
		const weeks = new Set([...keep].map((n) => isoWeekKey(parseBackupName(n)!)));
		expect(weeks.size).toBeLessThanOrEqual(4);
		expect(keep.size).toBeLessThanOrEqual(7 + 4);
		expect(keep.size).toBeGreaterThanOrEqual(7);
	});

	it('ignores unrelated files', () => {
		expect(selectBackupsToKeep(['backup.log', 'notes.txt'], 7, 4).size).toBe(0);
	});
});
