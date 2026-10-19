import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { friendBalances, userGroupSummaries } from '$lib/server/services/balances';
import { listMembers } from '$lib/server/services/groups';
import { listActivity } from '$lib/server/services/activity';
import { config } from '$lib/server/config';

export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user!;
	if (!user.onboardedAt) redirect(303, '/app/welcome');

	const summaries = userGroupSummaries(user.id);
	const owe = summaries.reduce((acc, s) => acc + Math.max(0, -s.myNet), 0);
	const owed = summaries.reduce((acc, s) => acc + Math.max(0, s.myNet), 0);
	const groups = summaries
		.filter((s) => s.group.kind === 'group' && !s.group.archivedAt)
		.map((s) => ({
			id: s.group.id,
			name: s.group.name,
			emoji: s.group.emoji,
			net: s.myNet,
			members: listMembers(s.group.id).filter((m) => m.active).length
		}))
		.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
	const friends = friendBalances(user.id, summaries, (gid) => listMembers(gid, user.id)).slice(
		0,
		8
	);
	return {
		owe,
		owed,
		groups,
		friends: friends.map((f) => ({
			key: f.userId ?? f.directGroupId ?? f.name,
			userId: f.userId,
			name: f.name,
			avatarUrl: f.avatarUrl,
			avatarColor: f.avatarColor,
			net: f.net,
			directGroupId: f.directGroupId,
			isGuest: !f.userId
		})),
		activity: listActivity(user.id, { limit: 6 }),
		vapidPublicKey: config.vapid.publicKey
	};
};
