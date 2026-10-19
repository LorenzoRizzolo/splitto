<script lang="ts">
	import { onMount } from 'svelte';
	import SpinningCoin from '$lib/components/three/SpinningCoin.svelte';
	import InstallButton from '$lib/components/pwa/InstallButton.svelte';
	import DemoSimulator from '$lib/components/home/DemoSimulator.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { toasts } from '$lib/client/toast.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { jsonLd, OG_IMAGE, SITE_NAME } from '$lib/seo';

	let { data } = $props();

	onMount(() => {
		if (data.deleted) toasts.success('Il tuo account è stato eliminato. A presto!');
	});

	const steps = [
		{
			emoji: '👥',
			title: 'Crea un gruppo',
			text: 'Casa, viaggio, coppia o serata: invita gli amici con un link o un QR code. Chi non è registrato si aggiunge solo con il nome.',
			anim: 'pop'
		},
		{
			emoji: '🧾',
			title: 'Aggiungi le spese',
			text: 'Chi ha pagato e come dividere: in parti uguali, per importi, percentuali, quote o voci dello scontrino.',
			anim: 'slide'
		},
		{
			emoji: '🤝',
			title: 'Salda i conti',
			text: 'Splitto ti dice chi deve a chi con il minor numero di pagamenti. Registra il rimborso e siete pari.',
			anim: 'spin'
		}
	];

	const features = [
		{
			icon: '👥',
			title: 'Gruppi',
			text: 'Casa, viaggi, coppia: ogni gruppo con i suoi membri e i suoi saldi.'
		},
		{ icon: '🤝', title: 'Amici', text: 'Spese 1-a-1 fuori dai gruppi e saldo con ogni amico.' },
		{
			icon: '➗',
			title: 'Tutte le divisioni',
			text: 'Parti uguali, importi esatti, percentuali, quote e aggiustamenti.'
		},
		{
			icon: '🧑‍🤝‍🧑',
			title: 'Più pagatori',
			text: 'Marco 30 € e Giulia 20 € sulla stessa spesa? Nessun problema.'
		},
		{
			icon: '🪄',
			title: 'Debiti semplificati',
			text: 'Il numero minimo di pagamenti per mettere tutti in pari.'
		},
		{
			icon: '💶',
			title: 'Sempre in euro',
			text: 'Importi al centesimo, senza arrotondamenti strani.'
		},
		{
			icon: '🔁',
			title: 'Spese ricorrenti',
			text: 'Affitto, bollette, abbonamenti: si aggiungono da sole.'
		},
		{
			icon: '⏰',
			title: 'Promemoria',
			text: '“Ricorda a Giulia” con un tocco, senza diventare insistenti.'
		},
		{ icon: '🔔', title: 'Notifiche', text: 'Ti avvisiamo di nuove spese, rimborsi e budget.' },
		{
			icon: '📊',
			title: 'Statistiche',
			text: 'Spese per categoria, andamento mensile e chi paga di più.'
		},
		{ icon: '🎯', title: 'Budget', text: 'Un tetto per il viaggio, con avviso all’80%.' },
		{
			icon: '📸',
			title: 'Scontrini',
			text: 'Foto dello scontrino e divisione voce per voce, con tasse e mancia.'
		},
		{ icon: '📤', title: 'Esportazione', text: 'CSV per Excel e riepilogo pronto per WhatsApp.' },
		{
			icon: '📶',
			title: 'Uso offline',
			text: 'Gruppi e saldi consultabili anche senza connessione.'
		},
		{ icon: '📱', title: 'Installabile', text: 'Si installa come un’app su telefono e computer.' }
	];

	const faqs = [
		{
			q: 'È gratis?',
			a: 'Sì. Splitto è gratuito, senza pubblicità e senza limiti di gruppi o spese.'
		},
		{
			q: 'I miei dati sono al sicuro?',
			a: 'Le password sono cifrate con Argon2, la connessione è protetta e ogni gruppo è visibile solo ai suoi membri. Non vendiamo i tuoi dati a nessuno.'
		},
		{
			q: 'Posso usarla senza installarla?',
			a: 'Certo: funziona in qualsiasi browser moderno. Installarla è comodo (icona sulla schermata Home, uso offline, notifiche) ma non obbligatorio.'
		},
		{
			q: 'Funziona su iPhone?',
			a: 'Sì. Da Safari tocca Condividi → Aggiungi alla schermata Home. Le notifiche push su iPhone richiedono iOS 16.4 o successivo e l’app installata.'
		},
		{
			q: 'I miei amici devono registrarsi?',
			a: 'No: puoi aggiungerli solo con il nome. Quando si registreranno con il tuo link di invito, ritroveranno tutte le loro spese.'
		},
		{
			q: 'Come si dividono le spese tra coinquilini?',
			a: 'Crea un gruppo “Casa”, aggiungi affitto, bollette e spesa (anche come spese ricorrenti) e scegli come dividerle: in parti uguali, per importi o per percentuali. Splitto aggiorna i saldi di tutti in tempo reale.'
		},
		{
			q: 'Come funziona la semplificazione dei debiti?',
			a: 'Splitto calcola il saldo di ogni persona e propone il numero minimo di pagamenti per mettere tutti in pari: invece di tanti piccoli rimborsi incrociati, bastano pochi bonifici.'
		},
		{
			q: 'Posso usare Splitto per un viaggio di gruppo?',
			a: 'Sì: crea un gruppo “Viaggio”, imposta un budget e aggiungi le spese man mano, anche offline. A fine viaggio Splitto ti dice chi deve dare quanto a chi.'
		}
	];

	const origin = $derived(data.origin);
	// Structured data for search engines: the app itself and the FAQ above.
	const structuredData = $derived(
		jsonLd({
			'@context': 'https://schema.org',
			'@graph': [
				{
					'@type': 'WebApplication',
					name: SITE_NAME,
					url: origin + '/',
					description:
						'App gratuita per dividere le spese tra amici, coinquilini e compagni di viaggio: chi ha pagato, chi deve a chi e come saldare con il minor numero di pagamenti.',
					applicationCategory: 'FinanceApplication',
					operatingSystem: 'Web, Android, iOS, Windows, macOS',
					inLanguage: 'it',
					image: origin + OG_IMAGE.path,
					offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
				},
				{
					'@type': 'WebSite',
					name: SITE_NAME,
					url: origin + '/',
					inLanguage: 'it'
				},
				{
					'@type': 'FAQPage',
					mainEntity: faqs.map((f) => ({
						'@type': 'Question',
						name: f.q,
						acceptedAnswer: { '@type': 'Answer', text: f.a }
					}))
				}
			]
		})
	);
</script>

<Seo
	title="Splitto — App gratis per dividere le spese tra amici e coinquilini"
	ogTitle="Splitto — Dividi le spese, non le amicizie"
	description="Splitto divide le spese tra amici, coinquilini e compagni di viaggio: chi ha pagato, chi deve a chi e come saldare con il minor numero di pagamenti. Gratis, senza pubblicità."
/>
<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD built from static data, `<` escaped -->
	{@html structuredData}
</svelte:head>

<header class="sticky top-0 z-30 border-b border-line/60 bg-surface-2/80 backdrop-blur">
	<nav
		class="mx-auto flex max-w-6xl items-center justify-between px-4 py-2"
		aria-label="Principale"
	>
		<a href="/" class="flex items-center gap-2 text-xl font-extrabold tracking-tight"
			><img src="/favicon.svg" alt="" width="32" height="32" /> Splitto</a
		>
		<div class="flex items-center gap-1">
			{#if data.user}
				<a href="/app" class="btn-primary">Vai alla dashboard</a>
			{:else}
				<a href="/login" class="btn-ghost">Accedi</a>
				<a href="/register" class="btn-primary hidden sm:inline-flex">Inizia gratis</a>
			{/if}
		</div>
	</nav>
</header>

<main id="main">
	<!-- Hero -->
	<section class="relative overflow-hidden">
		<div
			class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_30%,var(--color-brand-200),transparent)] opacity-60 dark:bg-[radial-gradient(60%_50%_at_70%_30%,var(--color-brand-900),transparent)]"
			aria-hidden="true"
		></div>
		<div class="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-20">
			<div>
				<p
					class="mb-3 inline-flex items-center gap-2 rounded-full bg-gold-300/40 px-3 py-1 text-sm font-semibold text-amber-900 dark:text-gold-300"
				>
					Gratis · niente pubblicità
				</p>
				<h1 class="text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
					Dividi le spese,<br /><span class="text-brand-700 dark:text-brand-300"
						>non le amicizie.</span
					>
				</h1>
				<p class="mt-5 max-w-lg text-lg text-ink-muted">
					L'app gratuita per dividere le spese: Splitto tiene il conto di chi ha pagato cosa con
					coinquilini, amici e compagni di viaggio, e ti dice chi deve a chi con il minor numero di
					pagamenti.
				</p>
				<div class="mt-8 flex flex-wrap gap-3">
					{#if data.user}
						<a href="/app" class="btn-primary px-6 text-base"
							>Vai alla dashboard <Icon name="arrowRight" size={18} /></a
						>
					{:else}
						<a href="/register" class="btn-primary px-6 text-base"
							>Inizia gratis <Icon name="arrowRight" size={18} /></a
						>
						<a href="/login" class="btn-secondary px-6 text-base">Accedi</a>
					{/if}
					<InstallButton class="btn-ghost px-5 text-base" />
				</div>
			</div>
			<div class="flex justify-center">
				<SpinningCoin class="aspect-square w-64 sm:w-80 md:w-96" />
			</div>
		</div>
	</section>

	<!-- How it works -->
	<section class="mx-auto max-w-6xl px-4 py-16" aria-labelledby="how-title">
		<h2 id="how-title" class="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
			Come funziona
		</h2>
		<p class="mt-2 text-center text-ink-muted">Tre passi, zero fogli Excel.</p>
		<ol class="mt-10 grid gap-6 md:grid-cols-3">
			{#each steps as s, i (s.title)}
				<li class="relative card p-6">
					<span
						class="absolute -top-4 left-6 flex size-8 items-center justify-center rounded-full bg-brand-700 font-bold text-white"
						>{i + 1}</span
					>
					<div
						class="step-illustration {s.anim} mb-4 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-100 to-gold-300/50 text-4xl dark:from-brand-900 dark:to-gold-600/30"
						aria-hidden="true"
					>
						{s.emoji}
					</div>
					<h3 class="text-xl font-bold">{s.title}</h3>
					<p class="mt-2 text-ink-muted">{s.text}</p>
				</li>
			{/each}
		</ol>
	</section>

	<!-- Features -->
	<section class="bg-surface py-16" aria-labelledby="features-title">
		<div class="mx-auto max-w-6xl px-4">
			<h2
				id="features-title"
				class="text-center text-3xl font-extrabold tracking-tight sm:text-4xl"
			>
				Tutto quello che serve
			</h2>
			<ul class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each features as f (f.title)}
					<li class="flex gap-4 rounded-2xl border border-line p-5">
						<span
							class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-2xl"
							aria-hidden="true">{f.icon}</span
						>
						<span>
							<h3 class="font-bold">{f.title}</h3>
							<p class="text-sm text-ink-muted">{f.text}</p>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- Interactive example -->
	<section class="mx-auto max-w-6xl px-4 py-16" aria-labelledby="demo-title">
		<h2 id="demo-title" class="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
			Provalo subito
		</h2>
		<p class="mx-auto mt-2 mb-10 max-w-2xl text-center text-ink-muted">
			Cena da 90 € in tre, ha pagato Marco. Cambia gli importi, aggiungi spese e guarda come la
			semplificazione riduce i pagamenti. Senza registrarti.
		</p>
		<DemoSimulator />
	</section>

	<!-- FAQ -->
	<section class="bg-surface py-16" aria-labelledby="faq-title">
		<div class="mx-auto max-w-3xl px-4">
			<h2 id="faq-title" class="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
				Domande frequenti
			</h2>
			<div class="mt-8 space-y-3">
				{#each faqs as f (f.q)}
					<details class="group rounded-2xl border border-line bg-surface-2 p-5">
						<summary
							class="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold"
						>
							{f.q}
							<Icon name="chevronDown" class="transition group-open:rotate-180" />
						</summary>
						<p class="mt-3 text-ink-muted">{f.a}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<section class="mx-auto max-w-6xl px-4 py-16 text-center">
		<h2 class="text-3xl font-extrabold tracking-tight">Pronto a fare pace con i conti?</h2>
		<div class="mt-6 flex flex-wrap justify-center gap-3">
			{#if data.user}
				<a href="/app" class="btn-primary px-6 text-base">Vai alla dashboard</a>
			{:else}
				<a href="/register" class="btn-primary px-6 text-base">Inizia gratis</a>
			{/if}
			<InstallButton />
		</div>
	</section>
</main>

<footer class="border-t border-line py-8">
	<div
		class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-ink-muted sm:flex-row"
	>
		<p class="flex items-center gap-2">
			<img src="/favicon.svg" alt="" width="20" height="20" /> Splitto · Dividi le spese, non le amicizie
		</p>
		<nav aria-label="Link utili" class="flex gap-4">
			<a href="/login" class="hover:text-ink">Accedi</a>
			<a href="/register" class="hover:text-ink">Registrati</a>
			<a href="#faq-title" class="hover:text-ink">FAQ</a>
			<a href="/privacy" class="hover:text-ink">Privacy</a>
		</nav>
		<p>© {new Date().getFullYear()} Splitto</p>
	</div>
</footer>

<style>
	.step-illustration.pop {
		animation: pop 2.4s ease-in-out infinite;
	}
	.step-illustration.slide {
		animation: slide 2.4s ease-in-out infinite;
	}
	.step-illustration.spin {
		animation: flip 3s ease-in-out infinite;
	}
	@keyframes pop {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.08) rotate(-3deg);
		}
	}
	@keyframes slide {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px) rotate(3deg);
		}
	}
	@keyframes flip {
		0%,
		60%,
		100% {
			transform: perspective(300px) rotateY(0);
		}
		80% {
			transform: perspective(300px) rotateY(180deg);
		}
	}
</style>
