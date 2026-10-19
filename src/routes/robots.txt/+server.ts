import type { RequestHandler } from './$types';
import { config } from '$lib/server/config';

// Generated (not in static/) so the sitemap URL follows ORIGIN.
export const GET: RequestHandler = () => {
	const body = [
		'User-agent: *',
		'Allow: /',
		// Private area, Google login endpoints and one-off pages.
		'Disallow: /app/',
		'Disallow: /login/',
		'Disallow: /invite/',
		'Disallow: /reset-password/',
		'Disallow: /offline',
		'',
		`Sitemap: ${config.origin}/sitemap.xml`,
		''
	].join('\n');
	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
