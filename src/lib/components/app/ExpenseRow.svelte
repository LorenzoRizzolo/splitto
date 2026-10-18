<script lang="ts">
	import { CATEGORY_INFO, type Category } from '$lib/domain/categories';
	import { formatMoney } from '$lib/domain/money';
	import Icon from '../ui/Icon.svelte';

	let {
		expense,
		names
	}: {
		expense: {
			id: string;
			description: string;
			category: Category;
			date: string;
			amountCents: number;
			myNet: number;
			myShare: number;
			hasReceipt: boolean;
			recurring: boolean;
			payers: { memberId: string; cents: number }[];
		};
		names: Map<string, string>;
	} = $props();

	const payerText = $derived(
		expense.payers.length === 1
			? names.get(expense.payers[0]!.memberId) === 'Tu'
				? `Hai pagato ${formatMoney(expense.amountCents)}`
				: `${names.get(expense.payers[0]!.memberId) ?? '?'} ha pagato ${formatMoney(expense.amountCents)}`
			: `${expense.payers.length} persone hanno pagato ${formatMoney(expense.amountCents)}`
	);
	const [, m, d] = $derived(expense.date.split('-'));
	const MONTHS = [
		'gen',
		'feb',
		'mar',
		'apr',
		'mag',
		'giu',
		'lug',
		'ago',
		'set',
		'ott',
		'nov',
		'dic'
	];
</script>

<a href="/app/expenses/{expense.id}" class="flex items-center gap-3 p-3 hover:bg-surface-3">
	<span class="w-9 shrink-0 text-center leading-tight text-ink-muted" aria-hidden="true">
		<span class="block text-[11px] uppercase">{MONTHS[Number(m) - 1]}</span>
		<span class="block text-lg font-bold text-ink">{Number(d)}</span>
	</span>
	<span
		class="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
		style:background-color="color-mix(in oklab, {CATEGORY_INFO[expense.category].color} 16%, transparent)"
		aria-hidden="true">{CATEGORY_INFO[expense.category].icon}</span
	>
	<span class="min-w-0 flex-1">
		<span class="flex items-center gap-1 truncate font-medium">
			{expense.description}
			{#if expense.recurring}<Icon
					name="repeat"
					size={14}
					label="Ricorrente"
					class="text-ink-muted"
				/>{/if}
			{#if expense.hasReceipt}<Icon
					name="receipt"
					size={14}
					label="Con scontrino"
					class="text-ink-muted"
				/>{/if}
		</span>
		<span class="block truncate text-sm text-ink-muted">{payerText}</span>
	</span>
	<span class="shrink-0 text-right text-sm">
		{#if expense.myNet > 0}
			<span class="block text-xs text-owed">hai prestato</span>
			<span class="font-semibold text-owed tabular-nums">{formatMoney(expense.myNet)}</span>
		{:else if expense.myNet < 0}
			<span class="block text-xs text-owe">devi</span>
			<span class="font-semibold text-owe tabular-nums">{formatMoney(-expense.myNet)}</span>
		{:else if expense.myShare > 0}
			<span class="text-xs text-ink-muted">in pari</span>
		{:else}
			<span class="text-xs text-ink-muted">non coinvolto</span>
		{/if}
	</span>
</a>
