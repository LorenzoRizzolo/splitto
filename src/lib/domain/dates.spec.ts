import { describe, expect, it } from 'vitest';
import { isValidISODate, nextOccurrence, todayISO } from './dates';

describe('nextOccurrence', () => {
	it('adds a week', () => {
		expect(nextOccurrence('2026-12-28', 'weekly')).toBe('2027-01-04');
	});

	it('keeps the anchor day across short months', () => {
		expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
		expect(nextOccurrence('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
		expect(nextOccurrence('2026-12-15', 'monthly')).toBe('2027-01-15');
	});

	it('handles leap years for yearly recurrences', () => {
		expect(nextOccurrence('2028-02-29', 'yearly')).toBe('2029-02-28');
		expect(nextOccurrence('2029-02-28', 'yearly', 29)).toBe('2030-02-28');
	});
});

describe('dates', () => {
	it('validates ISO dates', () => {
		expect(isValidISODate('2026-02-29')).toBe(false);
		expect(isValidISODate('2028-02-29')).toBe(true);
		expect(isValidISODate('2026-13-01')).toBe(false);
	});

	it('computes today in Europe/Rome', () => {
		// 23:30 UTC on Dec 31 is already Jan 1 in Rome.
		expect(todayISO(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
	});
});
