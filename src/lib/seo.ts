// Public, indexable pages. Everything else is sent with `X-Robots-Tag: noindex`
// (hooks.server.ts) and kept out of the sitemap.
export const INDEXABLE_PATHS = ['/', '/register', '/login', '/privacy'] as const;

export const SITE_NAME = 'Splitto';
export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630 } as const;

/** Serializes JSON-LD for an inline <script>, escaping `<` so it cannot close the tag. */
export function jsonLd(data: unknown): string {
	return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
