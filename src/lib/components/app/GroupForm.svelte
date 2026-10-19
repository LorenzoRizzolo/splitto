<script lang="ts">
	import { enhance } from '$app/forms';
	import FieldError from '../ui/FieldError.svelte';
	import Avatar from '../ui/Avatar.svelte';
	import { GROUP_EMOJIS, GROUP_TYPE_INFO } from '$lib/domain/groups';
	import { centsToInput } from '$lib/domain/money';
	import { trackDirty } from '$lib/client/sw.svelte';
	import { toasts } from '$lib/client/toast.svelte';

	type Values = {
		name: string;
		emoji: string;
		type: string;
		budgetCents: number | null;
	};
	type Friend = {
		userId: string;
		name: string;
		avatarUrl: string | null;
		avatarColor: string | null;
	};
	let {
		action = '',
		values,
		errors = {},
		submitLabel,
		withGuests = false,
		friends = [],
		successMessage
	}: {
		action?: string;
		values: Values;
		errors?: Record<string, string>;
		submitLabel: string;
		withGuests?: boolean;
		friends?: Friend[];
		successMessage?: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	let emoji = $state(values.emoji);
	// svelte-ignore state_referenced_locally
	let type = $state(values.type);
	let guests = $state<string[]>(['']);
	let submitting = $state(false);
</script>

<form
	method="POST"
	{action}
	class="space-y-6"
	use:trackDirty
	use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			submitting = false;
			if (result.type === 'success' && successMessage) toasts.success(successMessage);
		};
	}}
>
	<div>
		<label class="field-label" for="name">Nome del gruppo</label>
		<input
			id="name"
			name="name"
			class="field-input"
			required
			maxlength="60"
			placeholder="Es. Casa Via Roma, Weekend a Lisbona"
			value={values.name}
			aria-invalid={!!errors.name}
			aria-describedby="name-error"
		/>
		<FieldError id="name-error" message={errors.name} />
	</div>

	<fieldset>
		<legend class="field-label">Tipo</legend>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#each Object.entries(GROUP_TYPE_INFO) as [key, info] (key)}
				<label
					class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 dark:has-[:checked]:bg-brand-950"
				>
					<input
						type="radio"
						name="type"
						value={key}
						class="sr-only"
						bind:group={type}
						onchange={() => {
							if (GROUP_EMOJIS.slice(0, 4).includes(emoji)) emoji = info.emoji;
						}}
					/>
					<span aria-hidden="true">{info.emoji}</span>
					{info.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend class="field-label">Icona</legend>
		<div class="flex flex-wrap gap-2">
			{#each GROUP_EMOJIS as e (e)}
				<label
					class="flex size-11 cursor-pointer items-center justify-center rounded-xl border border-line text-xl has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 dark:has-[:checked]:bg-brand-950"
				>
					<input type="radio" name="emoji" value={e} class="sr-only" bind:group={emoji} />
					<span aria-hidden="true">{e}</span>
					<span class="sr-only">Icona {e}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<div>
		<label class="field-label" for="budget">Budget (facoltativo)</label>
		<div class="relative">
			<input
				id="budget"
				name="budget"
				class="field-input pr-10"
				inputmode="decimal"
				placeholder="Es. 1500"
				value={values.budgetCents ? centsToInput(values.budgetCents) : ''}
				aria-invalid={!!errors.budget}
				aria-describedby="budget-hint budget-error"
			/>
			<span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted"
				>€</span
			>
		</div>
		<p id="budget-hint" class="mt-1 text-xs text-ink-muted">
			Ti avvisiamo quando avete speso l'80%.
		</p>
		<FieldError id="budget-error" message={errors.budget} />
	</div>

	{#if withGuests}
		<fieldset>
			<legend class="field-label">Aggiungi subito delle persone (facoltativo)</legend>
			{#if friends.length}
				<p class="mb-2 text-sm text-ink-muted">Scegli tra i tuoi amici:</p>
				<div class="mb-4 flex flex-wrap gap-2">
					{#each friends as friend (friend.userId)}
						<label
							class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 dark:has-[:checked]:bg-brand-950"
						>
							<input type="checkbox" name="friend" value={friend.userId} class="sr-only" />
							<Avatar
								name={friend.name}
								src={friend.avatarUrl}
								color={friend.avatarColor}
								size={32}
							/>
							<span class="text-sm">{friend.name}</span>
						</label>
					{/each}
				</div>
				<p class="mb-2 text-sm text-ink-muted">Oppure aggiungi qualcuno nuovo.</p>
			{/if}
			<p class="mb-2 text-sm text-ink-muted">
				Basta il nome: potranno unirsi più tardi con il link di invito e ritrovare tutte le spese.
			</p>
			<div class="space-y-2">
				{#each guests as _, i (i)}
					<input
						name="guest"
						class="field-input"
						maxlength="60"
						placeholder="Nome (es. Giulia)"
						aria-label="Nome persona {i + 1}"
						bind:value={guests[i]}
						oninput={() => {
							if (i === guests.length - 1 && guests[i]?.trim() && guests.length < 20)
								guests.push('');
						}}
					/>
				{/each}
			</div>
		</fieldset>
	{/if}

	<button class="btn-primary w-full sm:w-auto" disabled={submitting}>{submitLabel}</button>
</form>
