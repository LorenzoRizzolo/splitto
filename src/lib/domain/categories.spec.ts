import { describe, expect, it } from 'vitest';
import { suggestCategory } from './categories';

describe('suggestCategory', () => {
	it.each([
		['Cena da Mario', 'food'],
		['Pizza venerdì', 'food'],
		['Spesa Esselunga', 'food'],
		['Bolletta luce', 'bills'],
		['Bollette gas marzo', 'bills'],
		['Affitto ottobre', 'home'],
		['Benzina A1', 'transport'],
		['Volo Ryanair Lisbona', 'travel'],
		['Airbnb Napoli', 'travel'],
		['Biglietti concerto', 'fun'],
		['CAFFÈ', 'food']
	])('%s → %s', (description, category) => {
		expect(suggestCategory(description)).toBe(category);
	});

	it('does not match short keywords inside other words', () => {
		expect(suggestCategory('Barca a vela')).toBeNull();
		expect(suggestCategory('')).toBeNull();
		expect(suggestCategory('Varie')).toBeNull();
	});
});
