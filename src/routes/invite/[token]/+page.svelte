<script lang="ts">
	import { page } from '$app/state';

	let { data } = $props();
	const title = $derived(
		data.valid
			? data.group.kind === 'direct'
				? `${data.inviterName ?? 'Un amico'} ti invita su Splitto`
				: `Unisciti a “${data.group.name}”`
			: ''
	);
</script>

<svelte:head>
	<title>{data.valid ? title : 'Invito non valido'} — Splitto</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-dvh items-center justify-center px-4 py-10">
	<main id="main" class="w-full max-w-md card p-6 text-center sm:p-8">
		<a href="/" class="mb-6 inline-flex items-center gap-2 text-xl font-extrabold"
			><img src="/favicon.svg" alt="" width="32" height="32" /> Splitto</a
		>
		{#if !data.valid}
			<p class="text-5xl" aria-hidden="true">⌛</p>
			<h1 class="mt-3 text-2xl font-bold">Invito non valido</h1>
			<p class="mt-2 text-ink-muted">
				Il link è scaduto o è stato revocato. Chiedi a chi ti ha invitato di mandartene uno nuovo.
			</p>
			<a href="/" class="mt-6 btn-secondary">Scopri Splitto</a>
		{:else}
			<p class="text-5xl" aria-hidden="true">{data.group.emoji}</p>
			<h1 class="mt-3 text-2xl font-bold">{title}</h1>
			{#if data.group.kind === 'group'}
				<p class="mt-2 text-ink-muted">
					{data.inviterName ? `${data.inviterName} ti ha invitato.` : ''}
					{data.memberNames.length ? `Nel gruppo: ${data.memberNames.join(', ')}.` : ''}
				</p>
			{:else}
				<p class="mt-2 text-ink-muted">
					Per dividere le spese tra voi due e vedere sempre chi deve cosa.
				</p>
			{/if}

			{#if data.already}
				<p class="mt-6 rounded-xl bg-brand-50 p-3 text-sm dark:bg-brand-950">
					Fai già parte di questo gruppo.
				</p>
				<a href="/app/groups/{data.group.id}" class="mt-4 btn-primary w-full">Apri il gruppo</a>
			{:else if !data.loggedIn}
				<div class="mt-6 space-y-2">
					<form method="POST">
						<button class="btn-primary w-full">Registrati e unisciti</button>
					</form>
					<a
						href="/login?redirectTo={encodeURIComponent(page.url.pathname)}"
						class="btn-secondary w-full">Ho già un account</a
					>
				</div>
			{:else}
				<form method="POST" class="mt-6 space-y-4 text-left">
					{#if data.guest}
						<input type="hidden" name="claim" value={data.guest.id} />
						<p class="rounded-xl bg-surface-2 p-3 text-sm">
							Sei <strong>{data.guest.name}</strong>? Entrando erediterai le spese già registrate a
							questo nome.
						</p>
					{:else if data.claimableGuests.length > 0}
						<fieldset>
							<legend class="field-label">Sei già nel gruppo come ospite?</legend>
							<div class="space-y-2">
								<label class="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3">
									<input type="radio" name="claim" value="" checked /> No, entro come nuovo membro
								</label>
								{#each data.claimableGuests as g (g.id)}
									<label
										class="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3"
									>
										<input type="radio" name="claim" value={g.id} /> Sono {g.name}
									</label>
								{/each}
							</div>
						</fieldset>
					{/if}
					<button class="btn-primary w-full">Unisciti</button>
				</form>
			{/if}
		{/if}
	</main>
</div>
