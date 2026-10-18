<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Money from '$lib/components/ui/Money.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { formatMoney } from '$lib/domain/money';

	let { data } = $props();
	const f = $derived(data.friend);
</script>

<svelte:head><title>{f.name} — Splitto</title></svelte:head>

<PageHeader title={f.name} back="/app/friends" />

<section class="mb-4 flex items-center gap-4 card p-5">
	<Avatar name={f.name} src={f.avatarUrl} color={f.avatarColor} size={64} />
	<div>
		{#if f.net === 0}
			<p class="text-2xl font-bold">Siete pari 🎉</p>
		{:else}
			<p class="text-sm text-ink-muted">
				{f.net > 0 ? `${f.name.split(' ')[0]} ti deve` : `Devi a ${f.name.split(' ')[0]}`}
			</p>
			<p class="text-3xl font-extrabold"><Money cents={f.net} /></p>
		{/if}
	</div>
</section>

<form method="POST" action="?/direct" class="mb-6">
	<button class="btn-primary w-full sm:w-auto"
		><Icon name="receipt" size={18} />
		{f.directGroupId ? 'Spese tra voi due' : 'Aggiungi una spesa tra voi due'}</button
	>
</form>

<h2 class="mb-2 font-bold">Dettaglio per gruppo</h2>
{#if f.byGroup.length === 0}
	<p class="text-sm text-ink-muted">Nessun debito aperto.</p>
{:else}
	<ul class="divide-y divide-line overflow-hidden card">
		{#each f.byGroup as g (g.groupId)}
			<li>
				<a
					href="/app/groups/{g.groupId}/balances"
					class="flex items-center justify-between gap-3 p-3 hover:bg-surface-3"
				>
					<span>{g.kind === 'direct' ? 'Spese 1-a-1' : g.groupName}</span>
					<span class="text-sm"
						>{#if g.net === 0}<span class="text-ink-muted">in pari</span>{:else}<Money
								cents={g.net}
							/>{/if}</span
					>
				</a>
			</li>
		{/each}
	</ul>
	<p class="mt-2 text-xs text-ink-muted">
		Totale: {formatMoney(Math.abs(f.net))}
		{f.net > 0 ? 'a tuo favore' : f.net < 0 ? 'a suo favore' : ''}
	</p>
{/if}
