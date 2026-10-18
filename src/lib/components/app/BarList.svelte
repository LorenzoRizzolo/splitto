<script lang="ts">
	import { formatMoney } from '$lib/domain/money';

	/** Horizontal bars with direct labels (identity never by color alone) and hover/focus tooltips. */
	let {
		rows,
		total
	}: {
		rows: {
			key: string;
			label: string;
			icon?: string;
			cents: number;
			color: string;
			secondary?: { cents: number; color: string; label: string };
		}[];
		total: number;
	} = $props();

	const max = $derived(Math.max(1, ...rows.flatMap((r) => [r.cents, r.secondary?.cents ?? 0])));
	const pct = (c: number) => (total > 0 ? Math.round((c * 100) / total) : 0);
</script>

<ul class="space-y-3">
	{#each rows as r, i (r.key)}
		<li>
			<div class="mb-1 flex items-baseline justify-between gap-2 text-sm">
				<span class="truncate"
					>{#if r.icon}<span aria-hidden="true">{r.icon}</span>
					{/if}{r.label}</span
				>
				<span class="font-semibold tabular-nums"
					>{formatMoney(r.cents)}
					<span class="font-normal text-ink-muted">· {pct(r.cents)}%</span></span
				>
			</div>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (focusable so keyboard users get the tooltip) -->
			<div
				class="group relative"
				tabindex="0"
				role="img"
				aria-label="{r.label}: {formatMoney(r.cents)}{r.secondary
					? `, ${r.secondary.label} ${formatMoney(r.secondary.cents)}`
					: ''}"
			>
				<div class="h-2.5 rounded-r bg-surface-3/60">
					<div
						class="bar h-full rounded-r"
						style:width="{(r.cents / max) * 100}%"
						style:background={r.color}
						style:animation-delay="{i * 60}ms"
					></div>
				</div>
				{#if r.secondary}
					<div class="mt-0.5 h-2.5 rounded-r bg-surface-3/60">
						<div
							class="bar h-full rounded-r"
							style:width="{(r.secondary.cents / max) * 100}%"
							style:background={r.secondary.color}
							style:animation-delay="{i * 60 + 30}ms"
						></div>
					</div>
				{/if}
				<span
					class="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-surface shadow group-hover:block group-focus-visible:block"
				>
					{r.label}: {formatMoney(r.cents)}{r.secondary
						? ` · ${r.secondary.label}: ${formatMoney(r.secondary.cents)}`
						: ''}
				</span>
			</div>
		</li>
	{/each}
</ul>

<style>
	.bar {
		transform-origin: left;
		animation: grow 800ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
		min-width: 4px;
	}
	@keyframes grow {
		from {
			transform: scaleX(0);
		}
	}
</style>
