<script lang="ts">
	import { slide } from 'svelte/transition';
	import Icon from '../ui/Icon.svelte';

	let { online }: { online: boolean } = $props();
</script>

{#if !online}
	<div
		transition:slide
		class="sticky top-0 z-40 flex items-center justify-center gap-2 bg-gold-400 px-4 py-2 text-center text-sm font-medium text-amber-950"
		role="status"
	>
		<Icon name="wifiOff" size={16} />
		Sei offline — i dati potrebbero non essere aggiornati
	</div>
{/if}
