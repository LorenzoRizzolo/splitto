import { describe, expect, it } from 'vitest';
import { debtSentence, shareSummary } from './summary';

describe('summary', () => {
	it('builds clear sentences', () => {
		expect(debtSentence({ from: 'Giulia', to: 'Marco', cents: 1250 })).toBe(
			'Giulia deve 12,50 € a Marco'
		);
		expect(debtSentence({ from: 'Giulia', to: 'Marco', cents: 1250 }, 'Giulia')).toBe(
			'Devi 12,50 € a Marco'
		);
		expect(debtSentence({ from: 'Giulia', to: 'Marco', cents: 1250 }, 'Marco')).toBe(
			'Giulia ti deve 12,50 €'
		);
	});

	it('builds a shareable summary', () => {
		expect(shareSummary('Casa', [], 1000)).toContain('Siete pari');
		expect(shareSummary('Casa', [{ from: 'A', to: 'B', cents: 100 }], 1000)).toContain(
			'• A deve 1,00 € a B'
		);
	});
});
