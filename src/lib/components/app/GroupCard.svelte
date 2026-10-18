<script lang="ts">
	import { tilt } from '$lib/client/tilt';
	import Money from '../ui/Money.svelte';

	let {
		href,
		emoji,
		name,
		subtitle,
		net,
		archived = false
	}: {
		href: string;
		emoji: string;
		name: string;
		subtitle?: string;
		net: number;
		archived?: boolean;
	} = $props();
</script>

<a
	{href}
	use:tilt
	class="flex items-center gap-4 card p-4 hover:border-brand-300 hover:shadow-lg dark:hover:border-brand-700"
	class:opacity-75={archived}
>
	<span
		class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-2xl"
		aria-hidden="true"
		style="transform: translateZ(20px)">{emoji}</span
	>
	<span class="min-w-0 flex-1">
		<span class="block truncate font-semibold">{name}</span>
		{#if subtitle}<span class="block truncate text-sm text-ink-muted">{subtitle}</span>{/if}
	</span>
	<span class="text-right text-sm">
		{#if net === 0}
			<span class="text-ink-muted">in pari</span>
		{:else}
			<span class="block text-xs text-ink-muted">{net > 0 ? 'ti devono' : 'devi'}</span>
			<Money cents={net} />
		{/if}
	</span>
</a>
