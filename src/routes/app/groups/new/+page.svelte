<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import GroupForm from '$lib/components/app/GroupForm.svelte';

	let { data, form } = $props();
	const v = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<svelte:head><title>Nuovo gruppo — Splitto</title></svelte:head>

<PageHeader
	title={data.first ? 'Il tuo primo gruppo' : 'Nuovo gruppo'}
	subtitle="Poi potrai invitare gli altri con un link o un QR code."
	back="/app/groups"
/>
<div class="card p-5 sm:p-6">
	<GroupForm
		values={{
			name: v.name ?? '',
			emoji: v.emoji ?? '👥',
			type: v.type ?? 'other',
			budgetCents: null
		}}
		errors={form?.errors ?? {}}
		submitLabel="Crea gruppo"
		withGuests
		friends={data.friends}
	/>
</div>
