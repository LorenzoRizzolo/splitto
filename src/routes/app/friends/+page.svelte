<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Money from '$lib/components/ui/Money.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let { data, form } = $props();
	const errors = $derived((form?.errors ?? {}) as Record<string, string>);
</script>

<svelte:head><title>Amici — Splitto</title></svelte:head>

<PageHeader
	title="Amici"
	subtitle="Saldi con ogni persona, sommando tutti i gruppi e le spese 1-a-1."
/>

<form method="POST" action="?/add" class="mb-6 card p-4" use:enhance>
	<label for="who" class="field-label">Aggiungi un amico</label>
	<div class="flex gap-2">
		<input
			id="who"
			name="who"
			class="field-input flex-1"
			placeholder="Email (se è già su Splitto) o nome"
			aria-describedby="who-hint who-error"
		/>
		<button class="btn-primary"><Icon name="userPlus" size={18} /> Aggiungi</button>
	</div>
	<p id="who-hint" class="mt-1 text-xs text-ink-muted">
		Con il solo nome crei un amico “ospite” e ottieni un link di invito da mandargli.
	</p>
	<FieldError id="who-error" message={errors.who} />
</form>

{#if data.friends.length === 0}
	<EmptyState
		emoji="🤝"
		title="Nessun amico ancora"
		description="Aggiungi un amico per dividere spese 1-a-1, fuori dai gruppi."
	/>
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
						guest={!f.userId}
						size={44}
					/>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-medium"
							>{f.name}{#if !f.userId}<span class="text-xs text-ink-muted">
									· invitato</span
								>{/if}</span
						>
						{#if f.groups.length}<span class="block truncate text-xs text-ink-muted"
								>{f.groups.join(', ')}</span
							>{/if}
					</span>
					<span class="text-right text-sm">
						{#if f.net === 0}<span class="text-ink-muted">in pari</span>{:else}
							<span class="block text-xs text-ink-muted">{f.net > 0 ? 'ti deve' : 'gli devi'}</span
							><Money cents={f.net} />
						{/if}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
