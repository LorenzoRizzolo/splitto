<script lang="ts">
	import { enhance } from '$app/forms';
	import GroupForm from '$lib/components/app/GroupForm.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { formatMoney } from '$lib/domain/money';
	import { formatDateShort, formatRelative } from '$lib/domain/dates';
	import { shareText } from '$lib/client/share';
	import { toasts } from '$lib/client/toast.svelte';

	let { data, form } = $props();

	const isDirect = $derived(data.group.kind === 'direct');
	const errors = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const action = $derived(form && 'action' in form ? form.action : null);
	const memberError = $derived(form && 'memberError' in form ? (form.memberError as string) : null);
	const guests = $derived(data.members.filter((m) => m.isGuest && m.active));
	const guestName = (id: string | null) => data.members.find((m) => m.id === id)?.name;
	const FREQ: Record<string, string> = {
		weekly: 'Ogni settimana',
		monthly: 'Ogni mese',
		yearly: 'Ogni anno'
	};

	let addKind = $state<'email' | 'guest'>('guest');
	let qrOpen = $state<string | null>(null);
	let qrModal = $state(false);
	const qrInvite = $derived(data.invites.find((i) => i.id === qrOpen));

	async function copyOrShare(url: string) {
		const r = await shareText(
			`Unisciti a “${data.group.title}” su Splitto per dividere le spese: ${url}`,
			'Invito Splitto'
		);
		if (r === 'copied') toasts.success('Link copiato');
	}

	const toast =
		(msg: string) =>
		() =>
		async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			await update();
			if (result.type === 'success') toasts.success(msg);
		};
</script>

<svelte:head><title>Impostazioni · {data.group.title} — Splitto</title></svelte:head>

<div class="space-y-6">
	{#if !isDirect}
		<!-- Members -->
		<section class="card p-5" aria-labelledby="members-title">
			<h2 id="members-title" class="mb-3 text-lg font-bold">Membri</h2>
			{#if memberError}<p
					class="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
					role="alert"
				>
					{memberError}
				</p>{/if}
			<ul class="divide-y divide-line">
				{#each data.members.filter((m) => m.active) as m (m.id)}
					<li class="flex flex-wrap items-center gap-3 py-2">
						<Avatar
							name={m.name}
							src={m.avatarUrl}
							color={m.avatarColor}
							guest={m.isGuest}
							size={36}
						/>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{m.isMe ? `${m.name} (tu)` : m.name}</span>
							<span class="text-xs text-ink-muted"
								>{m.isGuest
									? 'Ospite · non ancora registrato'
									: m.role === 'admin'
										? 'Amministratore'
										: 'Membro'}</span
							>
						</span>
						{#if data.isAdmin && !m.isMe && !data.group.archived}
							{#if !m.isGuest}
								<form method="POST" action="?/role" use:enhance={toast('Ruolo aggiornato')}>
									<input type="hidden" name="memberId" value={m.id} />
									<input
										type="hidden"
										name="role"
										value={m.role === 'admin' ? 'member' : 'admin'}
									/>
									<button class="btn-ghost min-h-11 px-3 text-sm"
										>{m.role === 'admin' ? 'Rendi membro' : 'Rendi admin'}</button
									>
								</form>
							{/if}
							<form
								method="POST"
								action="?/removeMember"
								use:enhance={({ cancel }) => {
									if (!confirm(`Rimuovere ${m.name} dal gruppo?`)) cancel();
									return toast(`${m.name} rimosso`)();
								}}
							>
								<input type="hidden" name="memberId" value={m.id} />
								<button
									class="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-3"
									aria-label="Rimuovi {m.name}"><Icon name="x" size={18} /></button
								>
							</form>
						{/if}
					</li>
				{/each}
			</ul>

			{#if !data.group.archived}
				<form
					method="POST"
					action="?/addMember"
					class="mt-4 rounded-2xl bg-surface-2 p-4"
					use:enhance={() =>
						async ({ result, update }) => {
							await update();
							if (result.type === 'success') toasts.success('Persona aggiunta');
						}}
				>
					<fieldset class="mb-3 flex gap-2">
						<legend class="sr-only">Come aggiungere</legend>
						<label
							class="flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm font-medium has-[:checked]:border-brand-600 has-[:checked]:bg-brand-600 has-[:checked]:text-white"
						>
							<input type="radio" name="kind" value="guest" bind:group={addKind} class="sr-only" /> Solo
							nome (ospite)
						</label>
						<label
							class="flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm font-medium has-[:checked]:border-brand-600 has-[:checked]:bg-brand-600 has-[:checked]:text-white"
						>
							<input type="radio" name="kind" value="email" bind:group={addKind} class="sr-only" /> Utente
							registrato
						</label>
					</fieldset>
					<div class="flex gap-2">
						{#if addKind === 'guest'}
							<label for="guest-name" class="sr-only">Nome</label>
							<input
								id="guest-name"
								name="name"
								class="field-input flex-1"
								placeholder="Nome (es. Andrea)"
								maxlength="60"
								aria-describedby="add-error"
							/>
						{:else}
							<label for="member-email" class="sr-only">Email</label>
							<input
								id="member-email"
								name="email"
								type="email"
								class="field-input flex-1"
								placeholder="email@esempio.it"
								aria-describedby="add-error"
							/>
						{/if}
						<button class="btn-primary"><Icon name="userPlus" size={18} /> Aggiungi</button>
					</div>
					<FieldError
						id="add-error"
						message={action === 'addMember' ? (errors.name ?? errors.email) : null}
					/>
					<p class="mt-2 text-xs text-ink-muted">
						Un ospite potrà registrarsi con il link di invito e ritroverà tutte le sue spese.
					</p>
				</form>
			{/if}
		</section>
	{/if}

	<!-- Invites -->
	{#if !data.group.archived && (!isDirect || guests.length > 0)}
		<section class="card p-5" aria-labelledby="invite-title">
			<h2 id="invite-title" class="mb-1 text-lg font-bold">Inviti</h2>
			<p class="mb-4 text-sm text-ink-muted">
				Il link vale 7 giorni e puoi revocarlo in qualsiasi momento. Dal vivo? Mostra il QR code.
			</p>
			<form
				method="POST"
				action="?/invite"
				class="mb-4 flex flex-wrap items-end gap-2"
				use:enhance={toast('Link di invito creato')}
			>
				{#if guests.length > 0}
					<div class="min-w-48 flex-1">
						<label for="guestMemberId" class="field-label">Per chi è l'invito?</label>
						<select id="guestMemberId" name="guestMemberId" class="field-input">
							{#if !isDirect}<option value="">Chiunque abbia il link</option>{/if}
							{#each guests as g (g.id)}<option value={g.id}
									>{g.name} (rivendica il profilo ospite)</option
								>{/each}
						</select>
					</div>
				{/if}
				<button class="btn-primary"><Icon name="link" size={18} /> Crea link di invito</button>
			</form>
			{#if data.invites.length > 0}
				<ul class="space-y-2">
					{#each data.invites as inv (inv.id)}
						<li class="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
							<span class="min-w-0 flex-1">
								<span class="block truncate font-mono text-xs">{inv.url}</span>
								<span class="text-xs text-ink-muted">
									{inv.guestMemberId ? `Per ${guestName(inv.guestMemberId)} · ` : ''}scade {formatRelative(
										new Date(inv.expiresAt)
									)}
								</span>
							</span>
							<button
								type="button"
								class="btn-secondary min-h-11 px-3 text-sm"
								onclick={() => copyOrShare(inv.url)}
								><Icon name="copy" size={16} /> Condividi</button
							>
							<button
								type="button"
								class="btn-secondary min-h-11 px-3 text-sm"
								onclick={() => {
									qrOpen = inv.id;
									qrModal = true;
								}}><Icon name="qr" size={16} /> QR</button
							>
							<form method="POST" action="?/revokeInvite" use:enhance={toast('Invito revocato')}>
								<input type="hidden" name="id" value={inv.id} />
								<button class="btn-ghost min-h-11 px-3 text-sm text-red-700 dark:text-red-400"
									>Revoca</button
								>
							</form>
							<noscript>
								<details class="w-full">
									<summary>Mostra QR</summary>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-generated SVG -->
									<div class="mx-auto w-56">{@html inv.qr}</div>
								</details>
							</noscript>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if !isDirect && data.isAdmin && !data.group.archived}
		<section class="card p-5" aria-labelledby="edit-title">
			<h2 id="edit-title" class="mb-4 text-lg font-bold">Dettagli del gruppo</h2>
			<GroupForm
				action="?/update"
				values={{
					name: data.group.name,
					emoji: data.group.emoji,
					type: data.group.type,
					budgetCents: data.group.budgetCents
				}}
				errors={action === 'update' ? errors : {}}
				submitLabel="Salva"
				successMessage="Impostazioni salvate"
			/>
		</section>
	{/if}

	<!-- Recurring -->
	<section class="card p-5" aria-labelledby="rec-title">
		<h2 id="rec-title" class="mb-1 text-lg font-bold">Spese ricorrenti</h2>
		{#if data.recurring.length === 0}
			<p class="text-sm text-ink-muted">
				Nessuna. Quando aggiungi una spesa puoi scegliere “Ripeti” (affitto, bollette,
				abbonamenti…).
			</p>
		{:else}
			<ul class="mt-3 divide-y divide-line">
				{#each data.recurring as r (r.id)}
					<li class="flex flex-wrap items-center gap-2 py-2">
						<Icon name="repeat" size={18} class="text-ink-muted" />
						<span class="min-w-0 flex-1">
							<span class="block font-medium">{r.description} · {formatMoney(r.amountCents)}</span>
							<span class="text-xs text-ink-muted"
								>{FREQ[r.frequency]} · {r.active
									? `prossima il ${formatDateShort(r.nextRunOn)}`
									: 'in pausa'}</span
							>
						</span>
						<form
							method="POST"
							action="?/recurring"
							use:enhance={toast('Spesa ricorrente aggiornata')}
						>
							<input type="hidden" name="id" value={r.id} />
							<button
								name="op"
								value={r.active ? 'pause' : 'resume'}
								class="btn-ghost min-h-11 px-3 text-sm"
								>{r.active ? 'Metti in pausa' : 'Riattiva'}</button
							>
							<button
								name="op"
								value="delete"
								class="btn-ghost min-h-11 px-3 text-sm text-red-700 dark:text-red-400"
								>Elimina</button
							>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if !isDirect}
		<section class="space-y-3 card p-5" aria-labelledby="danger-title">
			<h2 id="danger-title" class="text-lg font-bold">Gruppo</h2>
			{#if data.isAdmin}
				<form
					method="POST"
					action="?/archive"
					use:enhance={toast(data.group.archived ? 'Gruppo riattivato' : 'Gruppo archiviato')}
				>
					<input type="hidden" name="archived" value={data.group.archived ? 'false' : 'true'} />
					<button class="btn-secondary"
						><Icon name="archive" size={18} />
						{data.group.archived ? 'Riattiva il gruppo' : 'Archivia il gruppo'}</button
					>
					<p class="mt-1 text-xs text-ink-muted">
						Un gruppo archiviato (es. un viaggio finito) resta consultabile ma non modificabile.
					</p>
				</form>
			{/if}
			<form
				method="POST"
				action="?/leave"
				use:enhance={({ cancel }) => {
					if (!confirm('Vuoi davvero uscire dal gruppo?')) cancel();
				}}
			>
				<button class="btn-ghost text-red-700 dark:text-red-400" disabled={data.myNet !== 0}
					><Icon name="logout" size={18} /> Esci dal gruppo</button
				>
				{#if data.myNet !== 0}
					<p class="text-xs text-ink-muted">
						Puoi uscire solo con saldo a zero (ora {data.myNet > 0 ? 'devi ricevere' : 'devi dare'}
						{formatMoney(Math.abs(data.myNet))}).
					</p>
				{/if}
			</form>
		</section>
	{/if}
</div>

<Modal bind:open={qrModal} title="Inquadra per unirti" size="sm">
	{#if qrInvite}
		<div class="mx-auto w-64 rounded-2xl bg-white p-3">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-generated SVG -->
			{@html qrInvite.qr}
		</div>
		<p class="mt-3 text-center text-sm text-ink-muted">
			“{data.group.title}” · scade {formatRelative(new Date(qrInvite.expiresAt))}
		</p>
	{/if}
</Modal>
