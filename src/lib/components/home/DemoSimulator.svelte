<script lang="ts">
	import {
		computeNetBalances,
		computePairwiseDebts,
		type LedgerExpense
	} from '$lib/domain/balances';
	import { simplifyDebts } from '$lib/domain/simplify';
	import { computeSplit } from '$lib/domain/split';
	import { formatMoney, parseAmount } from '$lib/domain/money';
	import { debtSentence } from '$lib/domain/summary';

	// A tiny, no-signup simulation running the same domain code as the real app.
	const PEOPLE = ['Marco', 'Giulia', 'Luca'];

	let dinner = $state('90');
	let dinnerPayer = $state('Marco');
	let withTaxi = $state(true);
	let taxi = $state('30');
	let taxiPayer = $state('Giulia');
	let withDrinks = $state(false);

	function expense(amountText: string, payer: string): LedgerExpense | null {
		const cents = parseAmount(amountText);
		if (!cents) return null;
		const split = computeSplit(cents, { mode: 'equal', members: PEOPLE });
		if (!split.ok) return null;
		return { payers: [{ memberId: payer, cents }], shares: split.shares };
	}

	const expenses = $derived(
		[
			expense(dinner, dinnerPayer),
			withTaxi ? expense(taxi, taxiPayer) : null,
			// Drinks: Luca paid 24 € for Marco and Giulia only.
			withDrinks
				? {
						payers: [{ memberId: 'Luca', cents: 2400 }],
						shares: [
							{ memberId: 'Marco', cents: 1200 },
							{ memberId: 'Giulia', cents: 1200 }
						]
					}
				: null
		].filter((e): e is LedgerExpense => !!e)
	);
	const net = $derived(computeNetBalances(expenses));
	const pairwise = $derived(computePairwiseDebts(expenses));
	const simplified = $derived(simplifyDebts(net));
	const debts = $derived(simplified);
</script>

<div class="grid gap-6 lg:grid-cols-2">
	<div class="space-y-4 card p-5">
		<div class="flex flex-wrap items-end gap-3">
			<div class="flex-1">
				<label for="demo-dinner" class="field-label">🍝 Cena</label>
				<div class="relative">
					<input
						id="demo-dinner"
						class="field-input pr-8 text-right tabular-nums"
						inputmode="decimal"
						bind:value={dinner}
					/>
					<span
						class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted"
						>€</span
					>
				</div>
			</div>
			<div class="flex-1">
				<label for="demo-dinner-payer" class="field-label">Pagata da</label>
				<select id="demo-dinner-payer" class="field-input" bind:value={dinnerPayer}>
					{#each PEOPLE as p (p)}<option>{p}</option>{/each}
				</select>
			</div>
		</div>
		<label class="flex min-h-11 items-center gap-3"
			><input type="checkbox" class="size-5 rounded text-brand-600" bind:checked={withTaxi} /> Aggiungi
			il taxi</label
		>
		{#if withTaxi}
			<div class="flex flex-wrap items-end gap-3">
				<div class="flex-1">
					<label for="demo-taxi" class="field-label">🚕 Taxi</label>
					<div class="relative">
						<input
							id="demo-taxi"
							class="field-input pr-8 text-right tabular-nums"
							inputmode="decimal"
							bind:value={taxi}
						/>
						<span
							class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted"
							>€</span
						>
					</div>
				</div>
				<div class="flex-1">
					<label for="demo-taxi-payer" class="field-label">Pagato da</label>
					<select id="demo-taxi-payer" class="field-input" bind:value={taxiPayer}>
						{#each PEOPLE as p (p)}<option>{p}</option>{/each}
					</select>
				</div>
			</div>
		{/if}
		<label class="flex min-h-11 items-center gap-3"
			><input type="checkbox" class="size-5 rounded text-brand-600" bind:checked={withDrinks} /> 🍹 Drink
			da 24 € offerti da Luca (solo per Marco e Giulia)</label
		>
	</div>

	<div class="card p-5" aria-live="polite">
		<h3 class="mb-4 font-bold">Chi deve a chi</h3>
		{#if debts.length === 0}
			<p class="text-lg font-semibold">Siete pari! 🎉</p>
		{:else}
			<ul class="space-y-2">
				{#each debts as d (d.from + d.to)}
					<li class="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 font-medium">
						<span aria-hidden="true">💸</span>
						{debtSentence({ from: d.from, to: d.to, cents: d.cents })}
					</li>
				{/each}
			</ul>
		{/if}
		<p class="mt-4 text-sm text-ink-muted">
			{#if pairwise.length > simplified.length}
				Bastano <strong class="text-ink">{simplified.length}</strong>
				{simplified.length === 1 ? 'pagamento' : 'pagamenti'} invece di {pairwise.length}.
			{:else}
				Il minor numero di pagamenti possibile.
			{/if}
		</p>
		<ul class="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
			{#each PEOPLE as p (p)}
				{@const v = net.get(p) ?? 0}
				<li class="rounded-xl border border-line p-2">
					<span class="block font-semibold">{p}</span>
					<span class="tabular-nums {v > 0 ? 'text-owed' : v < 0 ? 'text-owe' : 'text-ink-muted'}"
						>{v === 0 ? 'pari' : `${v > 0 ? '+' : '−'}${formatMoney(Math.abs(v))}`}</span
					>
				</li>
			{/each}
		</ul>
	</div>
</div>
