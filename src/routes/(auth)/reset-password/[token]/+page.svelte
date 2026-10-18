<script lang="ts">
	import { enhance } from '$app/forms';
	import FieldError from '$lib/components/ui/FieldError.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Nuova password — Splitto</title></svelte:head>

<h1 class="mb-1 text-2xl font-bold">Scegli una nuova password</h1>

{#if !data.valid}
	<p
		class="mt-4 rounded-xl bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200"
		role="alert"
	>
		Questo link non è valido o è scaduto.
	</p>
	<a href="/forgot-password" class="mt-6 btn-primary w-full">Richiedi un nuovo link</a>
{:else}
	<form method="POST" class="mt-6 space-y-4" use:enhance novalidate>
		{#if form?.errors?.form}
			<p
				class="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
				role="alert"
			>
				{form.errors.form}
			</p>
		{/if}
		<div>
			<label class="field-label" for="password">Nuova password</label>
			<input
				class="field-input"
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength="8"
				required
				aria-describedby="password-error"
			/>
			<FieldError id="password-error" message={form?.errors?.password} />
		</div>
		<div>
			<label class="field-label" for="confirm">Ripeti la password</label>
			<input
				class="field-input"
				id="confirm"
				name="confirm"
				type="password"
				autocomplete="new-password"
				required
				aria-describedby="confirm-error"
			/>
			<FieldError id="confirm-error" message={form?.errors?.confirm} />
		</div>
		<button class="btn-primary w-full">Salva la password</button>
	</form>
{/if}
