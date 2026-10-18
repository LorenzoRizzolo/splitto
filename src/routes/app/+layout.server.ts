import type { LayoutServerLoad } from './$types';
import { avatarUrl } from '$lib/server/services/groups';

export const load: LayoutServerLoad = ({ locals }) => {
	const user = locals.user!;
	return {
		me: {
			id: user.id,
			name: user.name,
			email: user.email,
			avatarUrl: avatarUrl(user.id, user.avatarPath),
			avatarColor: user.avatarColor
		}
	};
};
