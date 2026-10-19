<script lang="ts">
	import { enhance } from '$app/forms';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import OAuthButtons from '$lib/components/auth/OAuthButtons.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	let { data, form } = $props();
	let submitting = $state(false);
	const values = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<Seo
	title="Accedi — Splitto"
	description="Accedi a Splitto per vedere i tuoi gruppi, le spese condivise e chi deve a chi."
/>

<h1 class="mb-1 text-2xl font-bold">Bentornato!</h1>
<p class="mb-6 text-ink-muted">Accedi per vedere i tuoi gruppi e i tuoi saldi.</p>

{#if data.reset}
	<p
		class="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100"
	>
		Password aggiornata. Accedi con la nuova password.
	</p>
{/if}

{#if data.oauthError}
	<p
		class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
		role="alert"
	>
		{data.oauthError}
	</p>
{/if}

<OAuthButtons providers={data.providers} redirectTo={data.redirectTo} />

<form
	method="POST"
	class="space-y-4"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
	novalidate
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
		<div class="flex items-baseline justify-between">
			<label class="field-label" for="password">Password</label>
			<a
				href="/forgot-password"
				class="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
				>Password dimenticata?</a
			>
		</div>
		<input
			class="field-input"
			id="password"
			name="password"
			type="password"
			autocomplete="current-password"
			required
			aria-invalid={!!form?.errors?.password}
			aria-describedby="password-error"
		/>
		<FieldError id="password-error" message={form?.errors?.password} />
	</div>
	<button class="btn-primary w-full" disabled={submitting}
		>{submitting ? 'Accesso…' : 'Accedi'}</button
	>
</form>

<p class="mt-6 text-center text-sm text-ink-muted">
	Non hai un account?
	<a
		class="font-semibold text-brand-700 hover:underline dark:text-brand-300"
		href="/register{data.redirectTo ? `?redirectTo=${encodeURIComponent(data.redirectTo)}` : ''}"
		>Registrati gratis</a
	>
</p>
