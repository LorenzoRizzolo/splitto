<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import InstallButton from '$lib/components/pwa/InstallButton.svelte';
	import PushToggle from '$lib/components/pwa/PushToggle.svelte';
	import { prefs, type Theme } from '$lib/client/preferences.svelte';
	import { clearUserCaches } from '$lib/client/sw.svelte';
	import { toasts } from '$lib/client/toast.svelte';

	let { data, form } = $props();
	const errors = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const action = $derived(form && 'action' in form ? form.action : null);
	const err = (a: string, k: string) => (action === a ? errors[k] : undefined);

	const EVENTS: { key: keyof typeof data.prefs; label: string }[] = [
		{ key: 'expense_added', label: 'Nuova spesa che ti riguarda' },
		{ key: 'expense_updated', label: 'Spesa modificata' },
		{ key: 'settlement_received', label: 'Rimborso ricevuto' },
		{ key: 'payment_reminder', label: 'Promemoria di pagamento' },
		{ key: 'group_invite', label: 'Inviti e nuovi membri nei gruppi' },
		{ key: 'recurring_generated', label: 'Spesa ricorrente generata' },
		{ key: 'budget_alert', label: 'Budget del gruppo all’80%' }
	];
	const THEMES: { id: Theme; label: string; icon: 'monitor' | 'sun' | 'moon' }[] = [
		{ id: 'system', label: 'Sistema', icon: 'monitor' },
		{ id: 'light', label: 'Chiaro', icon: 'sun' },
		{ id: 'dark', label: 'Scuro', icon: 'moon' }
	];

	const saved =
		(msg: string) =>
		() =>
		async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (o?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update({ reset: false });
			if (result.type === 'success') {
				toasts.success(msg);
				if (typeof result.data?.reduceMotion === 'boolean')
					prefs.setReduceMotion(result.data.reduceMotion);
			}
		};
</script>

<svelte:head><title>Profilo — Splitto</title></svelte:head>

<PageHeader title="Profilo" />

<div class="space-y-6">
	<section class="card p-5" aria-labelledby="me-title">
		<h2 id="me-title" class="mb-4 text-lg font-bold">I tuoi dati</h2>
		<div class="mb-5 flex flex-wrap items-center gap-4">
			<Avatar name={data.me.name} src={data.me.avatarUrl} color={data.me.avatarColor} size={72} />
			<form
				method="POST"
				action="?/avatar"
				enctype="multipart/form-data"
				class="flex flex-wrap items-center gap-2"
				use:enhance={saved('Foto aggiornata')}
			>
				<label class="btn-secondary cursor-pointer">
					<Icon name="image" size={18} /> Carica foto
					<input
						type="file"
						name="avatar"
						accept="image/jpeg,image/png,image/webp"
						class="sr-only"
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					/>
				</label>
				<noscript><button class="btn-secondary">Invia</button></noscript>
				{#if data.hasAvatar}
					<button name="remove" value="true" class="btn-ghost">Usa le iniziali</button>
				{/if}
			</form>
			<FieldError id="avatar-error" message={err('avatar', 'avatar')} />
		</div>
		<form method="POST" action="?/profile" class="space-y-4" use:enhance={saved('Profilo salvato')}>
			<div>
				<label for="name" class="field-label">Nome</label>
				<input
					id="name"
					name="name"
					class="field-input"
					value={data.me.name}
					maxlength="60"
					required
					aria-describedby="name-error"
				/>
				<FieldError id="name-error" message={err('profile', 'name')} />
			</div>
			<div>
				<span class="field-label">Email</span>
				<p class="text-ink-muted">{data.me.email}</p>
			</div>
			<p class="text-sm text-ink-muted">
				Valuta: <strong>Euro (€)</strong> — Splitto lavora solo in euro.
			</p>
			<button class="btn-primary">Salva</button>
		</form>
	</section>

	<section class="card p-5" aria-labelledby="look-title">
		<h2 id="look-title" class="mb-4 text-lg font-bold">Aspetto</h2>
		<fieldset class="mb-4">
			<legend class="field-label">Tema</legend>
			<div class="flex flex-wrap gap-2">
				{#each THEMES as t (t.id)}
					<button
						type="button"
						class="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium {prefs.theme ===
						t.id
							? 'border-brand-600 bg-brand-600 text-white'
							: 'border-line'}"
						aria-pressed={prefs.theme === t.id}
						onclick={() => prefs.setTheme(t.id)}
					>
						<Icon name={t.icon} size={16} />
						{t.label}
					</button>
				{/each}
			</div>
		</fieldset>
	</section>

	<form
		method="POST"
		action="?/preferences"
		class="space-y-4 card p-5"
		use:enhance={saved('Preferenze salvate')}
		aria-labelledby="notif-title"
	>
		<h2 id="notif-title" class="text-lg font-bold">Notifiche e animazioni</h2>
		<PushToggle vapidPublicKey={data.vapidPublicKey} />
		<fieldset>
			<legend class="field-label">Avvisami per…</legend>
			<div class="space-y-1">
				{#each EVENTS as e (e.key)}
					<label class="flex min-h-11 items-center gap-3">
						<input
							type="checkbox"
							name={e.key}
							checked={data.prefs[e.key]}
							class="size-5 rounded text-brand-600"
						/>
						{e.label}
					</label>
				{/each}
			</div>
		</fieldset>
		<label class="flex min-h-11 items-start gap-3 border-t border-line pt-4">
			<input
				type="checkbox"
				name="reduceMotion"
				checked={data.reduceMotion}
				class="mt-0.5 size-5 rounded text-brand-600"
			/>
			<span>
				<span class="block font-medium">Riduci animazioni</span>
				<span class="block text-sm text-ink-muted">Niente 3D e movimenti: solo dissolvenze.</span>
			</span>
		</label>
		<button class="btn-primary">Salva preferenze</button>
	</form>

	<section class="card p-5" aria-labelledby="app-title" id="installa">
		<h2 id="app-title" class="mb-2 text-lg font-bold">App</h2>
		<p class="mb-3 text-sm text-ink-muted">
			Installa Splitto sul telefono o sul computer: si apre come un'app e funziona anche offline in
			sola lettura.
		</p>
		<InstallButton />
	</section>

	<form
		method="POST"
		action="?/password"
		class="space-y-4 card p-5"
		use:enhance={saved('Password aggiornata')}
		aria-labelledby="pw-title"
	>
		<h2 id="pw-title" class="text-lg font-bold">Cambia password</h2>
		<div>
			<label for="current" class="field-label">Password attuale</label>
			<input
				id="current"
				name="current"
				type="password"
				autocomplete="current-password"
				class="field-input"
				aria-describedby="current-error"
			/>
			<FieldError id="current-error" message={err('password', 'current')} />
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="password" class="field-label">Nuova password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					minlength="8"
					class="field-input"
					aria-describedby="password-error"
				/>
				<FieldError id="password-error" message={err('password', 'password')} />
			</div>
			<div>
				<label for="confirm" class="field-label">Ripeti</label>
				<input
					id="confirm"
					name="confirm"
					type="password"
					autocomplete="new-password"
					class="field-input"
					aria-describedby="confirm-error"
				/>
				<FieldError id="confirm-error" message={err('password', 'confirm')} />
			</div>
		</div>
		<p class="text-xs text-ink-muted">Verrai disconnesso dagli altri dispositivi.</p>
		<button class="btn-primary">Aggiorna password</button>
	</form>

	<form method="POST" action="/logout" onsubmit={() => clearUserCaches()}>
		<button class="btn-secondary w-full"><Icon name="logout" size={18} /> Esci</button>
	</form>

	<details class="card p-5">
		<summary class="cursor-pointer font-semibold text-red-700 dark:text-red-400"
			>Elimina account</summary
		>
		{#if !data.settled}
			<p class="mt-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/40" role="alert">
				Hai ancora dei saldi aperti: puoi eliminare l'account solo quando tutti i tuoi conti sono a
				zero.
			</p>
		{:else}
			<form
				method="POST"
				action="?/delete"
				class="mt-3 space-y-3"
				use:enhance={({ cancel }) => {
					if (!confirm('Eliminare definitivamente il tuo account?')) cancel();
				}}
			>
				<p class="text-sm text-ink-muted">
					I gruppi conserveranno lo storico delle spese con il tuo nome. L'operazione non si può
					annullare.
				</p>
				{#if err('delete', 'form')}<p class="text-sm text-owe" role="alert">
						{err('delete', 'form')}
					</p>{/if}
				<label for="delete-password" class="field-label">Conferma con la password</label>
				<input
					id="delete-password"
					name="password"
					type="password"
					autocomplete="current-password"
					class="field-input"
					aria-describedby="delete-error"
				/>
				<FieldError id="delete-error" message={err('delete', 'deletePassword')} />
				<button class="btn bg-red-700 text-white hover:bg-red-800">Elimina definitivamente</button>
			</form>
		{/if}
	</details>
</div>
