<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { CATEGORY_INFO } from '$lib/domain/categories';
	import { formatMoney } from '$lib/domain/money';
	import { formatDateLong, formatRelative } from '$lib/domain/dates';
	import { toasts } from '$lib/client/toast.svelte';

	let { data, form } = $props();

	const byId = $derived(new Map(data.members.map((m) => [m.id, m])));
	const label = (id: string) => {
		const m = byId.get(id);
		return m ? (m.isMe ? 'Tu' : m.name) : 'Ex membro';
	};
	const MODE_LABEL: Record<string, string> = {
		equal: 'In parti uguali',
		exact: 'Importi esatti',
		percent: 'Per percentuale',
		shares: 'Per quote',
		adjust: 'Uguale con aggiustamenti',
		itemized: 'Per voci di scontrino'
	};
	const items = $derived(
		data.expense.splitMode === 'itemized'
			? (data.expense.splitInput as {
					items: { name: string; cents: number; memberIds: string[] }[];
					taxCents: number;
					tipCents: number;
				})
			: null
	);

	// Takes the id explicitly: the toast's "Annulla" runs after this page has been left.
	async function restore(expenseId: string) {
		const res = await fetch(`/app/expenses/${expenseId}?/restore`, {
			method: 'POST',
			body: new FormData(),
			headers: { 'x-sveltekit-action': 'true' }
		});
		if (res.ok) toasts.success('Spesa ripristinata');
		else toasts.error('Non è stato possibile ripristinare la spesa');
	}
</script>

<svelte:head><title>{data.expense.description} — Splitto</title></svelte:head>

<PageHeader
	title={data.expense.description}
	subtitle="{data.group.emoji} {data.group.title}"
	back="/app/groups/{data.group.id}"
>
	{#snippet actions()}
		{#if data.canEdit && !data.expense.deleted}
			<a href="/app/expenses/{data.expense.id}/edit" class="btn-secondary"
				><Icon name="pencil" size={16} /> Modifica</a
			>
		{/if}
	{/snippet}
</PageHeader>

{#if data.expense.deleted}
	<div
		class="mb-4 flex flex-wrap items-center justify-between gap-3 card border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/30"
	>
		<p class="flex items-center gap-2 text-sm">
			<Icon name="trash" size={18} /> Questa spesa è nel cestino e non conta nei saldi.
		</p>
		{#if data.canEdit}
			<form
				method="POST"
				action="?/restore"
				use:enhance={() =>
					async ({ update }) => {
						await update();
						toasts.success('Spesa ripristinata');
					}}
			>
				<button class="btn-primary"><Icon name="undo" size={16} /> Ripristina</button>
			</form>
		{/if}
	</div>
{/if}

<section class="mb-4 card p-5">
	<div class="flex items-center gap-4">
		<span
			class="flex size-14 items-center justify-center rounded-2xl text-3xl"
			style:background-color="color-mix(in oklab, {CATEGORY_INFO[data.expense.category].color} 16%, transparent)"
			aria-hidden="true">{CATEGORY_INFO[data.expense.category].icon}</span
		>
		<div>
			<p class="text-3xl font-extrabold tabular-nums">{formatMoney(data.expense.amountCents)}</p>
			<p class="text-sm text-ink-muted">
				{CATEGORY_INFO[data.expense.category].label} · {formatDateLong(data.expense.date)}
				{#if data.expense.recurring}· <Icon name="repeat" size={14} class="inline" /> ricorrente{/if}
			</p>
		</div>
	</div>
	<p class="mt-3 text-xs text-ink-muted">
		Aggiunta da {data.expense.creatorName}
		{formatRelative(new Date(data.expense.createdAt))}
		{#if new Date(data.expense.updatedAt).getTime() - new Date(data.expense.createdAt).getTime() > 1000}
			· modificata {formatRelative(new Date(data.expense.updatedAt))}
		{/if}
	</p>
	{#if data.expense.notes}
		<p class="mt-3 rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-line">{data.expense.notes}</p>
	{/if}
</section>

<div class="mb-4 grid gap-4 sm:grid-cols-2">
	<section class="card p-4" aria-labelledby="payers-title">
		<h2 id="payers-title" class="mb-2 font-bold">Ha pagato</h2>
		<ul class="space-y-2">
			{#each data.payers as p (p.memberId)}
				<li class="flex items-center gap-3">
					<Avatar
						name={byId.get(p.memberId)?.name ?? '?'}
						src={byId.get(p.memberId)?.avatarUrl}
						color={byId.get(p.memberId)?.avatarColor}
						size={32}
					/>
					<span class="flex-1">{label(p.memberId)}</span>
					<span class="font-semibold tabular-nums">{formatMoney(p.cents)}</span>
				</li>
			{/each}
		</ul>
	</section>
	<section class="card p-4" aria-labelledby="shares-title">
		<h2 id="shares-title" class="mb-1 font-bold">Quote</h2>
		<p class="mb-2 text-xs text-ink-muted">{MODE_LABEL[data.expense.splitMode]}</p>
		<ul class="space-y-2">
			{#each data.shares as s (s.memberId)}
				<li class="flex items-center gap-3">
					<Avatar
						name={byId.get(s.memberId)?.name ?? '?'}
						src={byId.get(s.memberId)?.avatarUrl}
						color={byId.get(s.memberId)?.avatarColor}
						size={32}
					/>
					<span class="flex-1">{label(s.memberId)}</span>
					<span class="tabular-nums">{formatMoney(s.cents)}</span>
				</li>
			{/each}
		</ul>
	</section>
</div>

{#if items}
	<section class="mb-4 card p-4" aria-labelledby="items-title">
		<h2 id="items-title" class="mb-2 font-bold">Voci dello scontrino</h2>
		<ul class="divide-y divide-line text-sm">
			{#each items.items as item, i (i)}
				<li class="flex justify-between gap-3 py-2">
					<span
						>{item.name || `Voce ${i + 1}`}
						<span class="text-ink-muted">· {item.memberIds.map(label).join(', ')}</span></span
					>
					<span class="tabular-nums">{formatMoney(item.cents)}</span>
				</li>
			{/each}
			{#if items.taxCents}<li class="flex justify-between py-2">
					<span>Tasse / coperto</span><span class="tabular-nums">{formatMoney(items.taxCents)}</span
					>
				</li>{/if}
			{#if items.tipCents}<li class="flex justify-between py-2">
					<span>Mancia</span><span class="tabular-nums">{formatMoney(items.tipCents)}</span>
				</li>{/if}
		</ul>
	</section>
{/if}

{#if data.expense.hasReceipt}
	<section class="mb-4 card p-4" aria-labelledby="receipt-title">
		<h2 id="receipt-title" class="mb-2 font-bold">Scontrino</h2>
		{#if data.expense.receiptIsPdf}
			<a
				class="btn-secondary"
				href="/app/expenses/{data.expense.id}/receipt"
				target="_blank"
				rel="noopener"><Icon name="receipt" size={18} /> Apri PDF</a
			>
		{:else}
			<a href="/app/expenses/{data.expense.id}/receipt" target="_blank" rel="noopener">
				<img
					src="/app/expenses/{data.expense.id}/receipt"
					alt="Scontrino di {data.expense.description}"
					class="max-h-96 rounded-xl border border-line object-contain"
					loading="lazy"
				/>
			</a>
		{/if}
	</section>
{/if}

<section class="mb-4 card p-4" aria-labelledby="comments-title">
	<h2 id="comments-title" class="mb-3 font-bold">Commenti</h2>
	{#if data.comments.length === 0}
		<p class="mb-3 text-sm text-ink-muted">Nessun commento.</p>
	{:else}
		<ul class="mb-3 space-y-3">
			{#each data.comments as c (c.id)}
				<li class="flex gap-3">
					<Avatar name={c.userName ?? 'Ex membro'} size={32} />
					<div class="min-w-0 flex-1 rounded-2xl bg-surface-2 px-3 py-2">
						<p class="text-xs text-ink-muted">
							<strong class="text-ink">{c.mine ? 'Tu' : (c.userName ?? 'Ex membro')}</strong> · {formatRelative(
								new Date(c.createdAt)
							)}
						</p>
						<p class="text-sm whitespace-pre-line">{c.body}</p>
					</div>
					{#if c.mine}
						<form method="POST" action="?/deleteComment" use:enhance>
							<input type="hidden" name="id" value={c.id} />
							<button
								class="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-3"
								aria-label="Elimina commento"
							>
								<Icon name="trash" size={16} />
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<form method="POST" action="?/comment" class="flex items-start gap-2" use:enhance>
		<label for="comment" class="sr-only">Scrivi un commento</label>
		<textarea
			id="comment"
			name="body"
			rows="1"
			maxlength="1000"
			class="field-input flex-1"
			placeholder="Scrivi un commento…"
			aria-describedby="comment-error"></textarea>
		<button class="btn-primary" aria-label="Invia commento"><Icon name="send" size={18} /></button>
	</form>
	<FieldError
		id="comment-error"
		message={form && 'commentError' in form ? form.commentError : null}
	/>
</section>

{#if data.canEdit && !data.expense.deleted}
	<form
		method="POST"
		action="?/delete"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type !== 'success') {
					toasts.error('Non è stato possibile eliminare la spesa');
					return;
				}
				const expenseId = data.expense.id;
				await goto(`/app/groups/${data.group.id}`, { invalidateAll: true });
				toasts.show('Spesa eliminata', {
					duration: 7000,
					action: {
						label: 'Annulla',
						run: async () => {
							await restore(expenseId);
							await invalidateAll();
						}
					}
				});
			};
		}}
	>
		<button class="btn-ghost w-full text-red-700 dark:text-red-400"
			><Icon name="trash" size={18} /> Elimina spesa</button
		>
	</form>
{/if}
