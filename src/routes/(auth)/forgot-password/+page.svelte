<script lang="ts">
	import { enhance } from '$app/forms';
	import FieldError from '$lib/components/ui/FieldError.svelte';

	let { form } = $props();
	const values = $derived(
		((form && 'values' in form ? form.values : {}) ?? {}) as Record<string, string>
	);
	const errors = $derived(
		((form && 'errors' in form ? form.errors : {}) ?? {}) as Record<string, string>
	);
</script>

<svelte:head><title>Password dimenticata — Splitto</title></svelte:head>

<h1 class="mb-1 text-2xl font-bold">Password dimenticata?</h1>

{#if form && 'sent' in form && form.sent}
	<p
		class="mt-4 rounded-xl bg-brand-50 p-4 text-brand-900 dark:bg-brand-950 dark:text-brand-100"
		role="status"
	>
		Se esiste un account per <strong>{form.email}</strong>, ti abbiamo inviato un link per
		reimpostare la password. Il link vale 1 ora.
	</p>
	<a href="/login" class="mt-6 btn-secondary w-full">Torna all'accesso</a>
{:else}
	<p class="mb-6 text-ink-muted">
		Inserisci la tua email: ti mandiamo un link per sceglierne una nuova.
	</p>
	<form method="POST" class="space-y-4" use:enhance novalidate>
		{#if errors.form}
			<p
				class="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
				role="alert"
			>
				{errors.form}
			</p>
		{/if}
		<div>
			<label class="field-label" for="email">Email</label>
			<input
				class="field-input"
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={values.email}
				aria-invalid={!!errors.email}
				aria-describedby="email-error"
			/>
			<FieldError id="email-error" message={errors.email} />
		</div>
		<button class="btn-primary w-full">Invia il link</button>
	</form>
	<p class="mt-6 text-center text-sm">
		<a class="font-semibold text-brand-700 hover:underline dark:text-brand-300" href="/login"
			>Torna all'accesso</a
		>
	</p>
{/if}
