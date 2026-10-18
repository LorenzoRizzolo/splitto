import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import {
	addGuest,
	addRegisteredMember,
	deactivateMember,
	getGroupMember,
	listMembers,
	requireAdmin,
	requireMembership,
	requireNotArchived,
	setArchived,
	setMemberRole,
	updateGroup
} from '$lib/server/services/groups';
import {
	createInvite,
	inviteUrl,
	listActiveInvites,
	revokeInvite
} from '$lib/server/services/invites';
import { deleteRecurring, listRecurring, setRecurringActive } from '$lib/server/services/recurring';
import { memberNet } from '$lib/server/services/balances';
import { notify } from '$lib/server/services/notify';
import { groupSchema, toGroupInput } from '$lib/server/group-form';
import { invalid, parseForm, zEmail, zName } from '$lib/server/forms';
import { qrSvg } from '$lib/server/qr';
import { formatMoney } from '$lib/domain/money';

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = requireMembership(locals.user!.id, params.id);
	const invites = await Promise.all(
		listActiveInvites(actor.group.id).map(async (i) => ({
			id: i.id,
			url: inviteUrl(i.token),
			qr: await qrSvg(inviteUrl(i.token)),
			expiresAt: i.expiresAt,
			guestMemberId: i.guestMemberId
		}))
	);
	return {
		invites,
		recurring: listRecurring(actor.group.id).map((r) => ({
			id: r.id,
			description: r.template.description,
			amountCents: r.template.amountCents,
			frequency: r.frequency,
			nextRunOn: r.nextRunOn,
			active: r.active
		})),
		myNet: memberNet(actor.group, actor.member.id)
	};
};

function zeroBalanceOrFail(net: number, who: string) {
	if (net === 0) return null;
	return fail(400, {
		memberError: `${who} ha un saldo di ${formatMoney(Math.abs(net))} ${net > 0 ? 'da ricevere' : 'da dare'}: prima bisogna saldare i conti.`
	});
}

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		requireAdmin(actor);
		requireNotArchived(actor);
		const form = parseForm(groupSchema, await request.formData());
		if (!form.ok) return invalid(form.errors, form.values, 'update');
		updateGroup(actor, toGroupInput(form.data));
		return { updated: true };
	},
	addMember: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		requireNotArchived(actor);
		const data = await request.formData();
		const kind = data.get('kind');
		if (kind === 'guest') {
			const form = parseForm(z.object({ name: zName }), data);
			if (!form.ok) return invalid(form.errors, form.values, 'addMember');
			addGuest(actor, form.data.name);
			return { added: form.data.name };
		}
		const form = parseForm(z.object({ email: zEmail }), data);
		if (!form.ok) return invalid(form.errors, form.values, 'addMember');
		const res = addRegisteredMember(actor, form.data.email);
		if (!res) {
			return invalid(
				{
					email:
						'Nessun utente con questa email. Aggiungilo come ospite e mandagli il link di invito.'
				},
				form.values,
				'addMember'
			);
		}
		if (res.already)
			return invalid({ email: `${res.name} fa già parte del gruppo` }, form.values, 'addMember');
		notify([res.userId], 'group_invite', {
			title: `${actor.group.emoji} Sei stato aggiunto a ${actor.group.name}`,
			body: 'Apri il gruppo per vedere le spese',
			url: `/app/groups/${actor.group.id}`
		});
		return { added: res.name };
	},
	invite: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		requireNotArchived(actor);
		const guest = (await request.formData()).get('guestMemberId');
		createInvite(actor, { guestMemberId: typeof guest === 'string' && guest ? guest : null });
		return { invited: true };
	},
	revokeInvite: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string') error(400);
		revokeInvite(actor, id);
		return { revoked: true };
	},
	removeMember: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		requireAdmin(actor);
		requireNotArchived(actor);
		const id = (await request.formData()).get('memberId');
		if (typeof id !== 'string') error(400);
		const target = getGroupMember(actor.group.id, id);
		if (target.id === actor.member.id)
			return fail(400, { memberError: 'Per uscire usa “Esci dal gruppo”' });
		const name = listMembers(actor.group.id).find((m) => m.id === id)?.name ?? 'Il membro';
		const blocked = zeroBalanceOrFail(memberNet(actor.group, id), name);
		if (blocked) return blocked;
		deactivateMember(actor, id, false, name);
		return { removed: name };
	},
	role: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		requireAdmin(actor);
		const data = await request.formData();
		const id = data.get('memberId');
		const role = data.get('role');
		if (typeof id !== 'string' || (role !== 'admin' && role !== 'member')) error(400);
		setMemberRole(actor, id, role);
		return { roleChanged: true };
	},
	leave: ({ locals, params }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		const blocked = zeroBalanceOrFail(memberNet(actor.group, actor.member.id), 'Il tuo profilo');
		if (blocked) return blocked;
		deactivateMember(actor, actor.member.id, true, locals.user!.name);
		redirect(303, '/app/groups');
	},
	archive: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		requireAdmin(actor);
		setArchived(actor, (await request.formData()).get('archived') === 'true');
		return { archivedChanged: true };
	},
	recurring: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		const data = await request.formData();
		const id = data.get('id');
		const op = data.get('op');
		if (typeof id !== 'string') error(400);
		if (op === 'delete') deleteRecurring(actor, id);
		else setRecurringActive(actor, id, op === 'resume');
		return { recurringChanged: true };
	}
};
