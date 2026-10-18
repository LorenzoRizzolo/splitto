<script lang="ts">
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import ExpenseForm from '$lib/components/app/ExpenseForm.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Modifica spesa — Splitto</title></svelte:head>

<PageHeader title="Modifica spesa" back="/app/expenses/{data.expense.id}" />
<div class="card p-4 sm:p-6">
	<ExpenseForm
		members={data.members}
		initial={data.expense}
		errors={form?.errors ?? {}}
		submitLabel="Salva modifiche"
	/>
</div>
