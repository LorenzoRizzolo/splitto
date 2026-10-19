import type { RequestHandler } from './$types';
import { config } from '$lib/server/config';
import { INDEXABLE_PATHS } from '$lib/seo';

const PRIORITY: Record<(typeof INDEXABLE_PATHS)[number], string> = {
	'/': '1.0',
	'/register': '0.8',
	'/login': '0.5',
	'/privacy': '0.3'
};

export const GET: RequestHandler = () => {
	const urls = INDEXABLE_PATHS.map(
		(path) =>
			`\t<url>\n\t\t<loc>${config.origin}${path}</loc>\n\t\t<priority>${PRIORITY[path]}</priority>\n\t</url>`
	).join('\n');
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
