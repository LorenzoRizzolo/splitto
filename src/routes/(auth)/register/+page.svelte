<script lang="ts">
	import { enhance } from '$app/forms';
	import FieldError from '$lib/components/ui/FieldError.svelte';

	let { data, form } = $props();
	let submitting = $state(false);
	const values = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<svelte:head><title>Registrati — Splitto</title></svelte:head>

<h1 class="mb-1 text-2xl font-bold">Crea il tuo account</h1>
<p class="mb-6 text-ink-muted">È gratis e ci vuole meno di un minuto.</p>

<form
	method="POST"
	class="space-y-4"
	novalidate
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	<input type="hidden" name="redirectTo" value={data.redirectTo} />
	{#if form?.errors?.form}
		<p
			class="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
			role="alert"
		>
			{form.errors.form}
		</p>
	{/if}
	<div>
		<label class="field-label" for="name">Nome</label>
		<input
			class="field-input"
			id="name"
			name="name"
			autocomplete="name"
			required
			maxlength="60"
			value={values.name}
			aria-invalid={!!form?.errors?.name}
			aria-describedby="name-error"
		/>
		<FieldError id="name-error" message={form?.errors?.name} />
	</div>
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
			aria-invalid={!!form?.errors?.email}
			aria-describedby="email-error"
		/>
		<FieldError id="email-error" message={form?.errors?.email} />
	</div>
	<div>
		<label class="field-label" for="password">Password</label>
		<input
			class="field-input"
			id="password"
			name="password"
			type="password"
			autocomplete="new-password"
			minlength="8"
			required
			aria-invalid={!!form?.errors?.password}
			aria-describedby="password-error password-hint"
		/>
		<p id="password-hint" class="mt-1 text-xs text-ink-muted">Almeno 8 caratteri.</p>
		<FieldError id="password-error" message={form?.errors?.password} />
	</div>
	<button class="btn-primary w-full" disabled={submitting}>
		{submitting ? 'Creazione account…' : 'Crea account'}
	</button>
</form>

<p class="mt-6 text-center text-sm text-ink-muted">
	Hai già un account?
	<a
		class="font-semibold text-brand-700 hover:underline dark:text-brand-300"
		href="/login{data.redirectTo ? `?redirectTo=${encodeURIComponent(data.redirectTo)}` : ''}"
		>Accedi</a
	>
</p>
