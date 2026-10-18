<script lang="ts">
	import { enhance } from '$app/forms';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CATEGORY_INFO } from '$lib/domain/categories';
	import { formatMoney } from '$lib/domain/money';
	import { formatDateShort, formatRelative } from '$lib/domain/dates';
	import { toasts } from '$lib/client/toast.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Cestino · {data.group.title} — Splitto</title></svelte:head>

<h2 class="mb-1 text-lg font-bold">Cestino</h2>
<p class="mb-4 text-sm text-ink-muted">
	Le spese eliminate non contano nei saldi. Puoi ripristinarle quando vuoi.
</p>

{#if data.trash.length === 0}
	<EmptyState emoji="🗑️" title="Il cestino è vuoto" />
{:else}
	<ul class="divide-y divide-line overflow-hidden card">
		{#each data.trash as e (e.id)}
			<li class="flex items-center gap-3 p-3">
				<span class="text-xl" aria-hidden="true">{CATEGORY_INFO[e.category].icon}</span>
				<a href="/app/expenses/{e.id}" class="min-w-0 flex-1">
					<span class="block truncate font-medium">{e.description}</span>
					<span class="text-sm text-ink-muted"
						>{formatDateShort(e.date)} · eliminata {e.deletedAt
							? formatRelative(new Date(e.deletedAt))
							: ''}</span
					>
				</a>
				<span class="font-semibold tabular-nums">{formatMoney(e.amountCents)}</span>
				{#if e.canRestore}
					<form
						method="POST"
						action="?/restore"
						use:enhance={() =>
							async ({ result, update }) => {
								await update();
								if (result.type === 'success') toasts.success('Spesa ripristinata');
							}}
					>
						<input type="hidden" name="id" value={e.id} />
						<button class="btn-secondary min-h-11 px-3 text-sm"
							><Icon name="undo" size={16} /> Ripristina</button
						>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
