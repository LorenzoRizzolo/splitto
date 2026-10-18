<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../ui/Icon.svelte';

	let {
		title,
		subtitle,
		back,
		actions
	}: { title: string; subtitle?: string; back?: string; actions?: Snippet } = $props();
</script>

<header class="mb-5 flex items-start gap-2">
	{#if back}
		<a
			href={back}
			class="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-3"
			aria-label="Indietro"
		>
			<Icon name="chevronLeft" />
		</a>
	{/if}
	<div class="min-w-0 flex-1">
		<h1 class="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
		{#if subtitle}<p class="mt-0.5 text-sm text-ink-muted">{subtitle}</p>{/if}
	</div>
	{#if actions}<div class="flex shrink-0 items-center gap-1">{@render actions()}</div>{/if}
</header>
