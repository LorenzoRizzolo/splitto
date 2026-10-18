<script lang="ts">
	import { formatMoney } from '$lib/domain/money';

	let { spent, budget }: { spent: number; budget: number } = $props();
	const pct = $derived(Math.round((spent * 100) / budget));
	const level = $derived(pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok');
</script>

<div class="card p-4">
	<div class="mb-2 flex items-baseline justify-between gap-2 text-sm">
		<span class="font-semibold">Budget</span>
		<span class="text-ink-muted tabular-nums">{formatMoney(spent)} di {formatMoney(budget)}</span>
	</div>
	<div
		class="h-3 overflow-hidden rounded-full bg-surface-3"
		role="progressbar"
		aria-label="Budget utilizzato"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.min(pct, 100)}
		aria-valuetext="{pct}% del budget"
	>
		<div
			class="budget-fill h-full rounded-full {level === 'ok'
				? 'bg-brand-500'
				: level === 'warn'
					? 'bg-gold-500'
					: 'bg-red-600'}"
			style:width="{Math.min(pct, 100)}%"
		></div>
	</div>
	{#if level !== 'ok'}
		<p
			class="mt-2 text-sm font-medium {level === 'over'
				? 'text-red-700 dark:text-red-400'
				: 'text-amber-700 dark:text-amber-300'}"
		>
			{level === 'over'
				? `Budget superato di ${formatMoney(spent - budget)}`
				: `Attenzione: avete usato il ${pct}% del budget`}
		</p>
	{/if}
</div>

<style>
	.budget-fill {
		animation: grow 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
		transform-origin: left;
	}
	@keyframes grow {
		from {
			transform: scaleX(0);
		}
	}
</style>
