<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import ExpenseForm from '$lib/components/app/ExpenseForm.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Nuova spesa — Splitto</title></svelte:head>

<PageHeader title="Nuova spesa" back="/app/groups/{data.groupId}" />

<form method="GET" class="mb-4 flex items-end gap-2 card p-4">
	<div class="flex-1">
		<label class="field-label" for="group">Gruppo</label>
		<select
			id="group"
			name="group"
			class="field-input"
			value={data.groupId}
			onchange={(e) =>
				goto(`/app/expenses/new?group=${e.currentTarget.value}`, { replaceState: true })}
		>
			{#each data.groups as g (g.id)}
				<option value={g.id}>{g.emoji} {g.kind === 'direct' ? `Tu e ${g.title}` : g.title}</option>
			{/each}
		</select>
	</div>
	<noscript><button class="btn-secondary">Cambia</button></noscript>
</form>

<div class="card p-4 sm:p-6">
	{#key data.groupId}
		<ExpenseForm
			members={data.members}
			initial={{
				description: '',
				amountCents: null,
				date: data.today,
				category: '',
				notes: '',
				payers: [{ memberId: data.myMemberId, cents: 0 }],
				split: null
			}}
			errors={form?.errors ?? {}}
			submitLabel="Aggiungi spesa"
			allowRepeat
			autofocusAmount
		/>
	{/key}
</div>
