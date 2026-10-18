<script lang="ts">
	import BarList from '$lib/components/app/BarList.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import AnimatedMoney from '$lib/components/ui/AnimatedMoney.svelte';
	import { CATEGORY_INFO } from '$lib/domain/categories';
	import { formatMoney } from '$lib/domain/money';
	import { formatMonth } from '$lib/domain/dates';

	let { data } = $props();
	const s = $derived(data.stats);
	const names = $derived(new Map(data.members.map((m) => [m.id, m.isMe ? 'Tu' : m.name])));
	const maxMonth = $derived(Math.max(1, ...s.monthly.map((m) => m.cents)));
	const peak = $derived(s.monthly.reduce((a, b) => (b.cents > a.cents ? b : a), s.monthly[0]!));
	const people = $derived(
		[...new Set([...s.paidBy.map((p) => p.memberId), ...s.consumedBy.map((p) => p.memberId)])]
			.map((id) => ({
				key: id,
				label: names.get(id) ?? 'Ex membro',
				cents: s.paidBy.find((p) => p.memberId === id)?.cents ?? 0,
				color: 'var(--series-paid)',
				secondary: {
					cents: s.consumedBy.find((p) => p.memberId === id)?.cents ?? 0,
					color: 'var(--series-share)',
					label: 'sua quota'
				}
			}))
			.sort((a, b) => b.cents - a.cents)
	);
</script>

<svelte:head><title>Statistiche · {data.group.title} — Splitto</title></svelte:head>

{#if s.count === 0}
	<EmptyState
		emoji="📊"
		title="Ancora niente da mostrare"
		description="Le statistiche compaiono dopo la prima spesa."
	/>
{:else}
	<div class="viz-root space-y-5">
		<section class="grid grid-cols-3 gap-3" aria-label="Riepilogo">
			<div class="card p-4">
				<p class="text-xs text-ink-muted">Totale</p>
				<p class="text-xl font-bold"><AnimatedMoney cents={s.total} /></p>
			</div>
			<div class="card p-4">
				<p class="text-xs text-ink-muted">Spese</p>
				<p class="text-xl font-bold tabular-nums">{s.count}</p>
			</div>
			<div class="card p-4">
				<p class="text-xs text-ink-muted">Media</p>
				<p class="text-xl font-bold"><AnimatedMoney cents={Math.round(s.total / s.count)} /></p>
			</div>
		</section>

		<section class="card p-5" aria-labelledby="cat-title">
			<h2 id="cat-title" class="mb-4 font-bold">Spesa per categoria</h2>
			<BarList
				total={s.total}
				rows={s.byCategory.map((c) => ({
					key: c.category,
					label: CATEGORY_INFO[c.category].label,
					icon: CATEGORY_INFO[c.category].icon,
					cents: c.cents,
					color: CATEGORY_INFO[c.category].color
				}))}
			/>
		</section>

		<section class="card p-5" aria-labelledby="month-title">
			<h2 id="month-title" class="font-bold">Andamento mensile</h2>
			<p class="mb-4 text-sm text-ink-muted">
				Ultimi 12 mesi · picco a {formatMonth(peak.month)}: {formatMoney(peak.cents)}
			</p>
			<div class="flex h-44 items-end gap-1 border-b border-line" role="list">
				{#each s.monthly as m, i (m.month)}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (focusable so keyboard users get the tooltip) -->
					<div
						class="group relative flex h-full flex-1 flex-col justify-end"
						role="listitem"
						tabindex="0"
						aria-label="{formatMonth(m.month)}: {formatMoney(m.cents)}"
					>
						<div
							class="col mx-auto w-full max-w-8 rounded-t bg-brand-600 dark:bg-brand-400"
							style:height="{(m.cents / maxMonth) * 100}%"
							style:animation-delay="{i * 40}ms"
							style:min-height={m.cents > 0 ? '4px' : '0'}
						></div>
						<span
							class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-surface group-hover:block group-focus-visible:block"
						>
							{formatMonth(m.month)}: {formatMoney(m.cents)}
						</span>
					</div>
				{/each}
			</div>
			<div class="mt-1 flex gap-1 text-[10px] text-ink-muted" aria-hidden="true">
				{#each s.monthly as m, i (m.month)}<span class="flex-1 text-center"
						>{i % 2 === 0 ? formatMonth(m.month).split(' ')[0] : ''}</span
					>{/each}
			</div>
		</section>

		<section class="card p-5" aria-labelledby="who-title">
			<h2 id="who-title" class="mb-1 font-bold">Chi paga di più</h2>
			<p class="mb-4 flex flex-wrap gap-4 text-xs text-ink-muted">
				<span class="flex items-center gap-1.5"
					><span class="inline-block h-2.5 w-4 rounded-sm" style:background="var(--series-paid)"
					></span> Ha pagato</span
				>
				<span class="flex items-center gap-1.5"
					><span class="inline-block h-2.5 w-4 rounded-sm" style:background="var(--series-share)"
					></span> Sua quota</span
				>
			</p>
			<BarList total={s.total} rows={people} />
		</section>

		<details class="card p-5">
			<summary class="cursor-pointer font-semibold">Mostra i dati in tabella</summary>
			<table class="mt-3 w-full text-sm">
				<caption class="sr-only">Pagato e quota per persona</caption>
				<thead
					><tr class="text-left text-ink-muted"
						><th class="py-1">Persona</th><th class="text-right">Pagato</th><th class="text-right"
							>Quota</th
						></tr
					></thead
				>
				<tbody>
					{#each people as p (p.key)}
						<tr class="border-t border-line"
							><td class="py-1.5">{p.label}</td><td class="text-right tabular-nums"
								>{formatMoney(p.cents)}</td
							><td class="text-right tabular-nums">{formatMoney(p.secondary.cents)}</td></tr
						>
					{/each}
				</tbody>
			</table>
		</details>
	</div>
{/if}

<style>
	.viz-root {
		--series-paid: #2a78d6;
		--series-share: #eb6834;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:where(:not([data-theme='light']))) .viz-root {
			--series-paid: #3987e5;
			--series-share: #d95926;
		}
	}
	:global(:root[data-theme='dark']) .viz-root {
		--series-paid: #3987e5;
		--series-share: #d95926;
	}
	.col {
		transform-origin: bottom;
		animation: rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	@keyframes rise {
		from {
			transform: scaleY(0);
		}
	}
</style>
