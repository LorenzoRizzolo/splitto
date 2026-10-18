<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import ActivityItem from '$lib/components/app/ActivityItem.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Attività — Splitto</title></svelte:head>

<PageHeader title="Attività" subtitle="Chi ha fatto cosa, in tutti i tuoi gruppi." />

{#if data.items.length === 0}
	<EmptyState
		emoji="📭"
		title="Nessuna attività"
		description="Qui vedrai spese, modifiche, rimborsi e nuovi membri."
	/>
{:else}
	<ul class="card p-1">
		{#each data.items as a (a.id)}
			<ActivityItem activity={a} />
		{/each}
	</ul>
	{#if data.next}
		<div class="mt-4 text-center">
			<a href="?before={data.next}" class="btn-secondary">Carica attività precedenti</a>
		</div>
	{/if}
{/if}
