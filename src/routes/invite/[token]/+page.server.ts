import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { acceptInvite, getInvite } from '$lib/server/services/invites';
import { getMembership, listMembers } from '$lib/server/services/groups';

export const load: PageServerLoad = ({ params, locals }) => {
	const info = getInvite(params.token);
	if (!info) return { valid: false as const };
	const members = listMembers(info.group.id).filter((m) => m.active);
	const already = locals.user ? !!getMembership(locals.user.id, info.group.id) : false;
	return {
		valid: true as const,
		group: {
			id: info.group.id,
			kind: info.group.kind,
			name: info.group.name,
			emoji: info.group.emoji
		},
		inviterName: info.inviterName,
		memberNames: members.filter((m) => !m.isGuest).map((m) => m.name),
		guest: info.guest,
		claimableGuests: info.claimableGuests,
		loggedIn: !!locals.user,
		already
	};
};

export const actions: Actions = {
	default: async ({ params, locals, request }) => {
		if (!locals.user)
			redirect(303, `/register?redirectTo=${encodeURIComponent(`/invite/${params.token}`)}`);
		const claim = (await request.formData()).get('claim');
		const { groupId, kind } = acceptInvite(
			params.token,
			locals.user.id,
			typeof claim === 'string' && claim ? claim : null
		);
		redirect(303, kind === 'direct' ? `/app/groups/${groupId}` : `/app/groups/${groupId}?joined=1`);
	}
};
