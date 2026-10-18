<script lang="ts">
	import { fly } from 'svelte/transition';
	import { updated } from '$app/state';
	import { applyUpdate, sw } from '$lib/client/sw.svelte';
	import Icon from '../ui/Icon.svelte';

	let dismissed = $state(false);
	const available = $derived(!dismissed && (!!sw.waiting || updated.current));
</script>

{#if available}
	<div
		transition:fly={{ y: -20, duration: 200 }}
		class="fixed inset-x-0 top-2 z-50 mx-auto flex w-[calc(100%-1rem)] max-w-lg items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-xl"
		role="status"
	>
		<Icon name="sparkles" class="text-brand-600" />
		<p class="flex-1 text-sm">È disponibile una nuova versione di Splitto</p>
		<button type="button" class="btn-primary min-h-11 px-4" onclick={applyUpdate}>Aggiorna</button>
		<button
			type="button"
			class="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-3"
			aria-label="Più tardi"
			onclick={() => (dismissed = true)}
		>
			<Icon name="x" size={18} />
		</button>
	</div>
{/if}
