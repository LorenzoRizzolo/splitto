<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		emoji = '🪙',
		children
	}: { title: string; description?: string; emoji?: string; children?: Snippet } = $props();
</script>

<div class="flex flex-col items-center gap-3 card px-6 py-10 text-center">
	<div
		class="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-gold-300/40 text-4xl dark:from-brand-900 dark:to-gold-600/30"
		aria-hidden="true"
	>
		{emoji}
	</div>
	<h3 class="text-lg font-bold">{title}</h3>
	{#if description}<p class="max-w-sm text-sm text-ink-muted">{description}</p>{/if}
	{#if children}<div class="mt-2 flex flex-wrap justify-center gap-2">
			{@render children()}
		</div>{/if}
</div>
