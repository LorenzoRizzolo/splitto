export const CATEGORIES = ['food', 'home', 'transport', 'fun', 'travel', 'bills', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

// Colors are CSS variables (validated categorical palette, light/dark variants in app.css).
export const CATEGORY_INFO: Record<Category, { label: string; icon: string; color: string }> = {
	food: { label: 'Cibo e bevande', icon: '🍕', color: 'var(--cat-food)' },
	home: { label: 'Casa', icon: '🏠', color: 'var(--cat-home)' },
	transport: { label: 'Trasporti', icon: '🚗', color: 'var(--cat-transport)' },
	fun: { label: 'Svago', icon: '🎉', color: 'var(--cat-fun)' },
	travel: { label: 'Viaggi', icon: '✈️', color: 'var(--cat-travel)' },
	bills: { label: 'Bollette', icon: '💡', color: 'var(--cat-bills)' },
	other: { label: 'Altro', icon: '📦', color: 'var(--cat-other)' }
};

const KEYWORDS: [Category, string[]][] = [
	[
		'food',
		[
			'cena',
			'pranzo',
			'colazione',
			'pizza',
			'ristorante',
			'bar',
			'caffè',
			'caffe',
			'spesa',
			'supermercato',
			'esselunga',
			'coop',
			'conad',
			'carrefour',
			'lidl',
			'aperitivo',
			'sushi',
			'gelato',
			'birra',
			'vino',
			'pasticceria',
			'panino',
			'kebab',
			'trattoria',
			'osteria',
			'pub'
		]
	],
	[
		'bills',
		[
			'bolletta',
			'luce',
			'gas',
			'acqua',
			'internet',
			'wifi',
			'fibra',
			'telefono',
			'enel',
			'tari',
			'condominio',
			'abbonamento',
			'netflix',
			'spotify',
			'disney',
			'prime'
		]
	],
	[
		'home',
		[
			'affitto',
			'casa',
			'pulizie',
			'detersivi',
			'ikea',
			'mobili',
			'arredamento',
			'riparazione',
			'idraulico',
			'elettricista',
			'leroy'
		]
	],
	[
		'transport',
		[
			'benzina',
			'gasolio',
			'carburante',
			'diesel',
			'autostrada',
			'pedaggio',
			'parcheggio',
			'taxi',
			'uber',
			'metro',
			'autobus',
			'bus',
			'tram',
			'telepass',
			'noleggio auto',
			'car sharing'
		]
	],
	[
		'travel',
		[
			'volo',
			'aereo',
			'ryanair',
			'easyjet',
			'treno',
			'trenitalia',
			'italo',
			'hotel',
			'albergo',
			'airbnb',
			'b&b',
			'booking',
			'ostello',
			'traghetto',
			'escursione',
			'museo',
			'souvenir'
		]
	],
	[
		'fun',
		[
			'cinema',
			'concerto',
			'teatro',
			'biglietti',
			'discoteca',
			'serata',
			'regalo',
			'festa',
			'compleanno',
			'palestra',
			'calcetto',
			'bowling',
			'giochi',
			'karaoke'
		]
	]
];

function normalize(s: string): string {
	return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Suggests a category from keywords in the description, or null when nothing matches. */
export function suggestCategory(description: string): Category | null {
	const text = ` ${normalize(description).replace(/[^\p{L}\p{N}&]+/gu, ' ')} `;
	if (text.trim() === '') return null;
	for (const [category, words] of KEYWORDS) {
		for (const word of words) {
			const w = normalize(word);
			// Short words must match exactly ("bar" ≠ "barca"); longer ones also as a prefix ("bollette").
			const hit = w.length >= 4 ? text.includes(` ${w.slice(0, -1)}`) : text.includes(` ${w} `);
			if (hit) return category;
		}
	}
	return null;
}
