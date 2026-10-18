<script lang="ts">
	import BalanceHero from '$lib/components/app/BalanceHero.svelte';
	import GroupCard from '$lib/components/app/GroupCard.svelte';
	import ActivityItem from '$lib/components/app/ActivityItem.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Money from '$lib/components/ui/Money.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { data } = $props();
	const firstName = $derived(data.me.name.split(' ')[0]);
</script>

<svelte:head><title>Dashboard — Splitto</title></svelte:head>

<h1 class="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Ciao {firstName} 👋</h1>

<BalanceHero owe={data.owe} owed={data.owed} />

<section aria-labelledby="groups-title" class="mb-8">
	<div class="mb-3 flex items-center justify-between">
		<h2 id="groups-title" class="text-lg font-bold">I tuoi gruppi</h2>
		<a href="/app/groups/new" class="btn-ghost min-h-11 px-3 text-brand-700 dark:text-brand-300">
			<Icon name="plus" size={18} /> Nuovo
		</a>
	</div>
	{#if data.groups.length === 0}
		<EmptyState
			emoji="🏝️"
			title="Nessun gruppo ancora"
			description="Crea un gruppo per la casa, un viaggio o una cena e invita i tuoi amici."
		>
			<a href="/app/groups/new" class="btn-primary">Crea il tuo primo gruppo</a>
		</EmptyState>
	{:else}
		<ul class="grid gap-3 sm:grid-cols-2">
			{#each data.groups as g (g.id)}
				<li>
					<GroupCard
						href="/app/groups/{g.id}"
						emoji={g.emoji}
						name={g.name}
						subtitle="{g.members} {g.members === 1 ? 'membro' : 'membri'}"
						net={g.net}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="friends-title" class="mb-8">
	<div class="mb-3 flex items-center justify-between">
		<h2 id="friends-title" class="text-lg font-bold">Amici</h2>
		<a href="/app/friends" class="btn-ghost min-h-11 px-3 text-brand-700 dark:text-brand-300"
			>Vedi tutti</a
		>
	</div>
	{#if data.friends.length === 0}
		<p class="card p-4 text-sm text-ink-muted">
			Qui vedrai quanto devi a ogni amico (e quanto ti deve).
			<a
				href="/app/friends"
				class="font-semibold text-brand-700 hover:underline dark:text-brand-300"
				>Aggiungi un amico</a
			>
		</p>
	{:else}
		<ul class="divide-y divide-line overflow-hidden card">
			{#each data.friends as f (f.key)}
				<li>
					<a
						href={f.userId ? `/app/friends/${f.userId}` : `/app/groups/${f.directGroupId}`}
						class="flex items-center gap-3 p-3 hover:bg-surface-3"
					>
						<Avatar
							name={f.name}
							src={f.avatarUrl}
							color={f.avatarColor}
							guest={f.isGuest}
							size={40}
						/>
						<span class="min-w-0 flex-1 truncate font-medium">{f.name}</span>
						<span class="text-right text-sm">
							{#if f.net === 0}
								<span class="text-ink-muted">in pari</span>
							{:else}
								<span class="block text-xs text-ink-muted"
									>{f.net > 0 ? 'ti deve' : 'gli devi'}</span
								>
								<Money cents={f.net} />
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="activity-title">
	<div class="mb-3 flex items-center justify-between">
		<h2 id="activity-title" class="text-lg font-bold">Attività recenti</h2>
		<a href="/app/activity" class="btn-ghost min-h-11 px-3 text-brand-700 dark:text-brand-300"
			>Vedi tutte</a
		>
	</div>
	{#if data.activity.length === 0}
		<p class="card p-4 text-sm text-ink-muted">Ancora nessuna attività.</p>
	{:else}
		<ul class="card p-1">
			{#each data.activity as a (a.id)}
				<ActivityItem activity={a} />
			{/each}
		</ul>
	{/if}
</section>
