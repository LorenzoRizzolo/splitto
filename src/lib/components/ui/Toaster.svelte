<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts } from '$lib/client/toast.svelte';
	import Icon from './Icon.svelte';
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
	aria-live="polite"
	role="status"
>
	{#each toasts.items as toast (toast.id)}
		<div
			transition:fly={{ y: 16, duration: 180 }}
			class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg {toast.kind ===
			'error'
				? 'bg-red-700 text-white'
				: 'bg-ink text-surface'}"
		>
			<Icon name={toast.kind === 'error' ? 'info' : 'check'} size={18} />
			<p class="flex-1">{toast.message}</p>
			{#if toast.action}
				<button
					type="button"
					class="min-h-11 rounded-full px-3 font-semibold underline-offset-2 hover:underline"
					onclick={async () => {
						toasts.dismiss(toast.id);
						await toast.action?.run();
					}}>{toast.action.label}</button
				>
			{/if}
			<button
				type="button"
				class="-mr-2 inline-flex size-11 items-center justify-center rounded-full opacity-80 hover:opacity-100"
				aria-label="Chiudi notifica"
				onclick={() => toasts.dismiss(toast.id)}
			>
				<Icon name="x" size={16} />
			</button>
		</div>
	{/each}
</div>
