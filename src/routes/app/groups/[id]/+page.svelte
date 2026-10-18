<script lang="ts">
	import { onMount } from 'svelte';
	import ExpenseRow from '$lib/components/app/ExpenseRow.svelte';
	import BudgetBar from '$lib/components/app/BudgetBar.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Money from '$lib/components/ui/Money.svelte';
	import { CATEGORIES, CATEGORY_INFO } from '$lib/domain/categories';
	import { formatMoney } from '$lib/domain/money';
	import { formatMonth } from '$lib/domain/dates';
	import { shareSummary } from '$lib/domain/summary';
	import { shareText } from '$lib/client/share';
	import { toasts } from '$lib/client/toast.svelte';

	let { data } = $props();

	const names = $derived(new Map(data.members.map((m) => [m.id, m.isMe ? 'Tu' : m.name])));
	const realNames = $derived(new Map(data.members.map((m) => [m.id, m.name])));
	const METHOD: Record<string, string> = {
		cash: 'contanti',
		bank: 'bonifico',
		paypal: 'PayPal',
		satispay: 'Satispay',
		other: 'altro'
	};

	type Entry =
		| { kind: 'expense'; date: string; key: string; e: (typeof data.expenses)[number] }
		| { kind: 'settlement'; date: string; key: string; s: (typeof data.settlements)[number] };

	const months = $derived.by(() => {
		const entries: Entry[] = [
			...data.expenses.map((e) => ({ kind: 'expense' as const, date: e.date, key: `e${e.id}`, e })),
			...data.settlements.map((s) => ({
				kind: 'settlement' as const,
				date: s.date,
				key: `s${s.id}`,
				s
			}))
		].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
		const groups: { month: string; entries: Entry[] }[] = [];
		for (const entry of entries) {
			const month = entry.date.slice(0, 7);
			const last = groups.at(-1);
			if (last?.month === month) last.entries.push(entry);
			else groups.push({ month, entries: [entry] });
		}
		return groups;
	});

	let showFilters = $state(false);
	onMount(() => {
		if (data.created) toasts.success('Gruppo creato! Ora invita gli altri dalle impostazioni.');
	});

	async function share() {
		const text = shareSummary(
			data.group.title,
			data.debts.map((d) => ({
				from: realNames.get(d.from) ?? '?',
				to: realNames.get(d.to) ?? '?',
				cents: d.cents
			})),
			data.spent
		);
		const r = await shareText(text, data.group.title);
		if (r === 'copied') toasts.success('Riepilogo copiato: incollalo dove vuoi');
		else if (r === 'failed') toasts.error('Non è stato possibile condividere il riepilogo');
	}
</script>

<svelte:head><title>{data.group.title} — Splitto</title></svelte:head>

<section class="mb-4 grid gap-3 sm:grid-cols-2">
	<div class="flex items-center justify-between gap-3 card p-4">
		<div>
			<p class="text-sm text-ink-muted">Il tuo saldo</p>
			<p class="text-2xl font-bold">
				{#if data.myNet === 0}<span class="text-ink">In pari</span>{:else}<Money
						cents={data.myNet}
					/>{/if}
			</p>
			<p class="text-xs text-ink-muted">
				{data.myNet > 0
					? 'ti devono'
					: data.myNet < 0
						? 'devi'
						: data.settled
							? 'tutto il gruppo è in pari'
							: 'tu sei a posto'}
			</p>
		</div>
		<a href="/app/groups/{data.group.id}/balances" class="btn-secondary">Salda</a>
	</div>
	{#if data.group.budgetCents}
		<BudgetBar spent={data.spent} budget={data.group.budgetCents} />
	{:else}
		<div class="flex items-center justify-between gap-3 card p-4">
			<div>
				<p class="text-sm text-ink-muted">Spesa totale</p>
				<p class="text-2xl font-bold tabular-nums">{formatMoney(data.spent)}</p>
			</div>
		</div>
	{/if}
</section>

<div class="mb-4 flex flex-wrap gap-2">
	{#if !data.group.archived}
		<a href="/app/expenses/new?group={data.group.id}" class="btn-primary"
			><Icon name="plus" size={18} /> Aggiungi spesa</a
		>
	{/if}
	<button type="button" class="btn-secondary" onclick={share}
		><Icon name="share" size={18} /> Riepilogo</button
	>
	<a
		href="/app/groups/{data.group.id}/export.csv"
		class="btn-secondary"
		download
		data-sveltekit-reload><Icon name="download" size={18} /> CSV</a
	>
	<button
		type="button"
		class="btn-secondary"
		aria-expanded={showFilters || data.filtering}
		aria-controls="filters"
		onclick={() => (showFilters = !showFilters)}><Icon name="filter" size={18} /> Filtri</button
	>
</div>

<form
	id="filters"
	method="GET"
	class="mb-4 grid gap-3 card p-4 sm:grid-cols-2"
	class:hidden={!showFilters && !data.filtering}
	data-sveltekit-keepfocus
	data-sveltekit-noscroll
>
	<div class="sm:col-span-2">
		<label class="field-label" for="q">Cerca</label>
		<input
			id="q"
			name="q"
			type="search"
			class="field-input"
			placeholder="Descrizione o note"
			value={data.filters.q}
		/>
	</div>
	<div>
		<label class="field-label" for="category">Categoria</label>
		<select id="category" name="category" class="field-input">
			<option value="">Tutte</option>
			{#each CATEGORIES as c (c)}
				<option value={c} selected={data.filters.category === c}
					>{CATEGORY_INFO[c].icon} {CATEGORY_INFO[c].label}</option
				>
			{/each}
		</select>
	</div>
	<div>
		<label class="field-label" for="member">Persona</label>
		<select id="member" name="member" class="field-input">
			<option value="">Tutti</option>
			{#each data.members as m (m.id)}
				<option value={m.id} selected={data.filters.member === m.id}
					>{m.isMe ? 'Tu' : m.name}</option
				>
			{/each}
		</select>
	</div>
	<div>
		<label class="field-label" for="from">Dal</label>
		<input id="from" name="from" type="date" class="field-input" value={data.filters.from} />
	</div>
	<div>
		<label class="field-label" for="to">Al</label>
		<input id="to" name="to" type="date" class="field-input" value={data.filters.to} />
	</div>
	<div class="flex gap-2 sm:col-span-2">
		<button class="btn-primary"><Icon name="search" size={18} /> Applica</button>
		{#if data.filtering}<a href="/app/groups/{data.group.id}" class="btn-ghost">Azzera filtri</a
			>{/if}
	</div>
</form>

{#if months.length === 0}
	{#if data.filtering}
		<EmptyState emoji="🔍" title="Nessuna spesa trovata" description="Prova a cambiare i filtri.">
			<a href="/app/groups/{data.group.id}" class="btn-secondary">Azzera filtri</a>
		</EmptyState>
	{:else}
		<EmptyState
			emoji="🧾"
			title="Nessuna spesa ancora"
			description="Aggiungi la prima spesa: Splitto calcolerà subito chi deve a chi."
		>
			{#if !data.group.archived}
				<a href="/app/expenses/new?group={data.group.id}" class="btn-primary">Aggiungi la prima</a>
			{/if}
		</EmptyState>
	{/if}
{:else}
	{#each months as m (m.month)}
		<section class="mb-4">
			<h2 class="mb-2 px-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
				{formatMonth(m.month)}
			</h2>
			<ul class="divide-y divide-line overflow-hidden card">
				{#each m.entries as entry (entry.key)}
					<li>
						{#if entry.kind === 'expense'}
							<ExpenseRow expense={entry.e} {names} />
						{:else}
							<a
								href="/app/groups/{data.group.id}/balances"
								class="flex items-center gap-3 p-3 hover:bg-surface-3"
							>
								<span class="w-9 shrink-0" aria-hidden="true"></span>
								<span
									class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl dark:bg-emerald-950"
									aria-hidden="true">💸</span
								>
								<span class="min-w-0 flex-1 text-sm">
									<span class="block font-medium">
										{names.get(entry.s.from) === 'Tu'
											? `Hai rimborsato ${names.get(entry.s.to)}`
											: `${names.get(entry.s.from)} ha rimborsato ${names.get(entry.s.to) === 'Tu' ? 'te' : names.get(entry.s.to)}`}
									</span>
									<span class="block text-ink-muted">{METHOD[entry.s.method]}</span>
								</span>
								<span class="text-sm font-semibold tabular-nums">{formatMoney(entry.s.cents)}</span>
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
	<p class="mt-6 text-center text-sm">
		<a
			href="/app/groups/{data.group.id}/trash"
			class="inline-flex min-h-11 items-center gap-1 text-ink-muted hover:text-ink"
		>
			<Icon name="trash" size={16} /> Cestino del gruppo
		</a>
	</p>
{/if}
