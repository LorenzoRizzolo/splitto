import type { PageServerLoad } from './$types';
import { listActivity } from '$lib/server/services/activity';

const PAGE = 40;

export const load: PageServerLoad = ({ locals, url }) => {
	const beforeRaw = Number(url.searchParams.get('before'));
	const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? new Date(beforeRaw) : undefined;
	const items = listActivity(locals.user!.id, { limit: PAGE + 1, before });
	const more = items.length > PAGE;
	const page = items.slice(0, PAGE);
	return { items: page, next: more ? page.at(-1)!.createdAt.getTime() : null };
};
