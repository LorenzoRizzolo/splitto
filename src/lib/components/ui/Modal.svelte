<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		title,
		children,
		footer,
		size = 'md'
	}: {
		open?: boolean;
		title: string;
		children: Snippet;
		footer?: Snippet;
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
	aria-labelledby="modal-title"
	class="m-auto w-[calc(100%-2rem)] rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm {size ===
	'sm'
		? 'max-w-sm'
		: size === 'lg'
			? 'max-w-2xl'
			: 'max-w-lg'}"
>
	{#if open}
		<div class="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
			<h2 id="modal-title" class="text-lg font-bold">{title}</h2>
			<button
				type="button"
				class="-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-3"
				aria-label="Chiudi"
				onclick={() => (open = false)}
			>
				<Icon name="x" />
			</button>
		</div>
		<div class="max-h-[70dvh] overflow-y-auto px-5 py-4">
			{@render children()}
		</div>
		{#if footer}
			<div class="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
				{@render footer()}
			</div>
		{/if}
	{/if}
</dialog>
