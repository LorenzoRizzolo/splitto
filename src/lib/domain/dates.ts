// Calendar-date helpers working on 'YYYY-MM-DD' strings (no timezone surprises).

export const APP_TIMEZONE = 'Europe/Rome';

/** Today's date in the app timezone, as 'YYYY-MM-DD'. */
export function todayISO(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: APP_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

function parts(iso: string): [number, number, number] {
	const [y, m, d] = iso.split('-').map(Number);
	return [y!, m!, d!];
}

function fmt(y: number, m: number, d: number): string {
	return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
	return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export type Frequency = 'weekly' | 'monthly' | 'yearly';

/**
 * Next occurrence after `iso`. For monthly/yearly, `anchorDay` (the original day of month)
 * is kept when possible: Jan 31 → Feb 28 → Mar 31.
 */
export function nextOccurrence(iso: string, frequency: Frequency, anchorDay?: number): string {
	const [y, m, d] = parts(iso);
	const anchor = anchorDay ?? d;
	if (frequency === 'weekly') {
		const date = new Date(Date.UTC(y, m - 1, d + 7));
		return fmt(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
	}
	if (frequency === 'monthly') {
		const ny = m === 12 ? y + 1 : y;
		const nm = m === 12 ? 1 : m + 1;
		return fmt(ny, nm, Math.min(anchor, daysInMonth(ny, nm)));
	}
	return fmt(y + 1, m, Math.min(anchor, daysInMonth(y + 1, m)));
}

export function isValidISODate(iso: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
	const [y, m, d] = parts(iso);
	return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

const longFmt = new Intl.DateTimeFormat('it-IT', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});
const shortFmt = new Intl.DateTimeFormat('it-IT', {
	day: 'numeric',
	month: 'short',
	timeZone: 'UTC'
});
const monthFmt = new Intl.DateTimeFormat('it-IT', {
	month: 'short',
	year: '2-digit',
	timeZone: 'UTC'
});

function toUTC(iso: string): Date {
	const [y, m, d] = parts(iso);
	return new Date(Date.UTC(y, m - 1, d));
}

export const formatDateLong = (iso: string) => longFmt.format(toUTC(iso));
export const formatDateShort = (iso: string) => shortFmt.format(toUTC(iso));
/** "2026-10" → "ott 26" */
export const formatMonth = (ym: string) => monthFmt.format(toUTC(`${ym}-01`));

const rtf = new Intl.RelativeTimeFormat('it-IT', { numeric: 'auto' });

/** "2 ore fa", "ieri", "3 giorni fa"… */
export function formatRelative(date: Date | number, now = Date.now()): string {
	const diff = (typeof date === 'number' ? date : date.getTime()) - now;
	const abs = Math.abs(diff);
	const MIN = 60_000;
	const HOUR = 60 * MIN;
	const DAY = 24 * HOUR;
	if (abs < MIN) return 'adesso';
	if (abs < HOUR) return rtf.format(Math.round(diff / MIN), 'minute');
	if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
	if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), 'day');
	if (abs < 365 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), 'month');
	return rtf.format(Math.round(diff / (365 * DAY)), 'year');
}
