<svelte:head>
	<title>Sei offline — Splitto</title>
	<!-- Prerendered: served as a static file, without the X-Robots-Tag set in hooks. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<main id="main" class="flex min-h-dvh items-center justify-center px-4">
	<div class="max-w-md card p-8 text-center">
		<p class="text-6xl" aria-hidden="true">📡</p>
		<h1 class="mt-4 text-2xl font-bold">Sei offline</h1>
		<p class="mt-2 text-ink-muted">
			Questa pagina non è ancora disponibile senza connessione. Le pagine che hai già visitato
			(gruppi, saldi) restano consultabili.
		</p>
		<p class="mt-2 text-sm text-ink-muted">Per aggiungere spese o rimborsi serve la rete.</p>
		<div class="mt-6 flex flex-wrap justify-center gap-2">
			<a href="/app" class="btn-primary">Vai alla dashboard</a>
			<button type="button" class="btn-secondary" onclick={() => location.reload()}>Riprova</button>
		</div>
	</div>
</main>
