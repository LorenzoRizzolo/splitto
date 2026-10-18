<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import GroupCard from '$lib/components/app/GroupCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { data } = $props();

	function names(members: string[]) {
		if (members.length <= 3) return members.join(', ');
		return `${members.slice(0, 3).join(', ')} e altri ${members.length - 3}`;
	}
</script>

<svelte:head><title>Gruppi — Splitto</title></svelte:head>

<PageHeader title="Gruppi">
	{#snippet actions()}
		<a href="/app/groups/new" class="btn-primary"><Icon name="plus" size={18} /> Nuovo gruppo</a>
	{/snippet}
</PageHeader>

{#if data.active.length === 0}
	<EmptyState
		emoji="🏝️"
		title="Nessun gruppo attivo"
		description="I gruppi servono per dividere le spese con coinquilini, compagni di viaggio o il partner."
	>
		<a href="/app/groups/new" class="btn-primary">Crea un gruppo</a>
	</EmptyState>
{:else}
	<ul class="grid gap-3 sm:grid-cols-2">
		{#each data.active as g (g.id)}
			<li>
				<GroupCard
					href="/app/groups/{g.id}"
					emoji={g.emoji}
					name={g.name}
					subtitle={names(g.members)}
					net={g.net}
				/>
			</li>
		{/each}
	</ul>
{/if}

{#if data.archived.length > 0}
	<details class="mt-8">
		<summary class="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-ink-muted">
			<Icon name="archive" size={18} /> Gruppi archiviati ({data.archived.length})
		</summary>
		<ul class="mt-3 grid gap-3 sm:grid-cols-2">
			{#each data.archived as g (g.id)}
				<li>
					<GroupCard
						href="/app/groups/{g.id}"
						emoji={g.emoji}
						name={g.name}
						subtitle="Archiviato"
						net={g.net}
						archived
					/>
				</li>
			{/each}
		</ul>
	</details>
{/if}
