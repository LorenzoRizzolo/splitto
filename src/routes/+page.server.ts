import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({ deleted: url.searchParams.has('deleted') });
