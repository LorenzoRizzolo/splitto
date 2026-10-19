import type { LayoutServerLoad } from './$types';
import { config } from '$lib/server/config';

export const load: LayoutServerLoad = ({ locals }) => ({
	// Public URL (ORIGIN) for canonical links and social previews, same as in sitemap.xml.
	origin: config.origin,
	user: locals.user
		? { id: locals.user.id, name: locals.user.name, reduceMotion: locals.user.reduceMotion }
		: null
});
