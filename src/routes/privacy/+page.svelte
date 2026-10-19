<script lang="ts">
	import Seo from '$lib/components/seo/Seo.svelte';
	import { LEGAL } from '$lib/legal';

	let { data } = $props();

	const updated = new Date(`${LEGAL.updatedAt}T12:00:00`).toLocaleDateString('it-IT', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
</script>

<Seo
	title="Informativa sulla privacy — Splitto"
	description="Quali dati tratta Splitto, perché, per quanto tempo e come puoi esercitare i tuoi diritti. Niente pubblicità, niente profilazione, nessuna vendita di dati."
/>

<header class="border-b border-line/60 bg-surface-2/80">
	<nav
		class="mx-auto flex max-w-3xl items-center justify-between px-4 py-2"
		aria-label="Principale"
	>
		<a href="/" class="flex items-center gap-2 text-xl font-extrabold tracking-tight"
			><img src="/favicon.svg" alt="" width="32" height="32" /> Splitto</a
		>
		<a href={data.user ? '/app' : '/register'} class="btn-ghost"
			>{data.user ? 'Vai alla dashboard' : 'Inizia gratis'}</a
		>
	</nav>
</header>

<main
	id="main"
	class="legal mx-auto max-w-3xl px-4 py-10 [&_a]:text-brand-700 [&_a]:underline dark:[&_a]:text-brand-300"
>
	<h1 class="text-4xl font-extrabold tracking-tight">Informativa sulla privacy</h1>
	<p class="mt-2 text-sm text-ink-muted">Ultimo aggiornamento: {updated}</p>

	<p class="mt-6 rounded-2xl bg-brand-50 p-4 dark:bg-brand-950">
		<strong>In breve:</strong> usiamo i tuoi dati solo per far funzionare Splitto. Niente pubblicità,
		niente profilazione, niente strumenti di analisi o tracciamento, e non vendiamo né cediamo i tuoi
		dati a nessuno.
	</p>

	<p>
		Questa informativa spiega come vengono trattati i dati personali di chi usa Splitto, ai sensi
		del Regolamento (UE) 2016/679 ("GDPR") e del D.lgs. 196/2003.
	</p>

	<h2>1. Chi è il titolare del trattamento</h2>
	<p>
		Il titolare del trattamento è <strong>{LEGAL.controller}</strong>. Per qualsiasi domanda o
		richiesta sulla privacy puoi scrivere a
		<a href="mailto:{LEGAL.contactEmail}">{LEGAL.contactEmail}</a>.
	</p>

	<h2>2. Quali dati trattiamo</h2>
	<h3>Dati del tuo account</h3>
	<ul>
		<li>nome, indirizzo email e, se la carichi, la foto del profilo;</li>
		<li>
			la password, che non conserviamo mai in chiaro ma solo come impronta cifrata (Argon2): nemmeno
			noi possiamo leggerla;
		</li>
		<li>le tue preferenze (notifiche, riduzione delle animazioni).</li>
	</ul>
	<h3>Se accedi con Google</h3>
	<p>
		Google ci comunica il tuo nome, il tuo indirizzo email (e se è verificato) e un identificativo
		del tuo account Google. Non riceviamo la tua password di Google né altri dati come contatti,
		calendario o file.
	</p>
	<h3>Quello che inserisci nell'app</h3>
	<ul>
		<li>
			gruppi, spese, importi, categorie, date, note, commenti, rimborsi, spese ricorrenti, budget e
			promemoria;
		</li>
		<li>le foto degli scontrini che decidi di allegare;</li>
		<li>
			i nomi delle persone che aggiungi a un gruppo come "ospiti" senza account. Aggiungi solo
			persone che sono d'accordo a comparire nel gruppo.
		</li>
	</ul>
	<h3>Notifiche push</h3>
	<p>
		Se le attivi, salviamo l'indirizzo tecnico fornito dal tuo browser per recapitare le notifiche,
		le relative chiavi di cifratura e il tipo di browser/dispositivo, per mostrarti l'elenco dei
		dispositivi collegati.
	</p>
	<h3>Dati tecnici</h3>
	<ul>
		<li>
			<strong>indirizzo IP</strong>, usato per limitare i tentativi di accesso e registrazione
			(contro gli attacchi ai profili) e registrato nei log del server;
		</li>
		<li>data e ora delle richieste, pagina richiesta e tipo di browser (log del server);</li>
		<li>le sessioni di accesso attive.</li>
	</ul>

	<h2>3. Perché li trattiamo e su quale base</h2>
	<div class="overflow-x-auto">
		<table>
			<thead>
				<tr><th>Finalità</th><th>Base giuridica (GDPR)</th></tr>
			</thead>
			<tbody>
				<tr>
					<td>Creare e gestire il tuo account, far funzionare gruppi, spese e saldi</td>
					<td>esecuzione del servizio che hai richiesto (art. 6.1.b)</td>
				</tr>
				<tr>
					<td>Inviarti le email di servizio, come il link per reimpostare la password</td>
					<td>esecuzione del servizio (art. 6.1.b)</td>
				</tr>
				<tr>
					<td>Inviarti notifiche push</td>
					<td>il tuo consenso, che puoi revocare in ogni momento dal profilo (art. 6.1.a)</td>
				</tr>
				<tr>
					<td>Sicurezza: prevenire abusi e accessi non autorizzati, log tecnici, backup</td>
					<td>legittimo interesse a proteggere il servizio e i dati degli utenti (art. 6.1.f)</td>
				</tr>
			</tbody>
		</table>
	</div>
	<p>
		Non usiamo i tuoi dati per pubblicità, profilazione o decisioni automatizzate, e non li
		vendiamo.
	</p>

	<h2>4. Chi può vedere i tuoi dati</h2>
	<ul>
		<li>
			<strong>Gli altri membri dei tuoi gruppi</strong> vedono il tuo nome, la tua foto e le spese, i
			commenti, gli scontrini e i rimborsi del gruppo. Nelle spese tra amici fuori dai gruppi, li vede
			solo l'altra persona coinvolta.
		</li>
		<li>
			<strong>Fornitori che ci aiutano a far funzionare Splitto</strong>, che trattano i dati solo
			per nostro conto (responsabili del trattamento):
			<ul>
				<li>server e database: {LEGAL.hosting};</li>
				<li>
					Cloudflare, Inc., che protegge il sito e lo rende veloce: tutto il traffico passa dai suoi
					server, compreso il tuo indirizzo IP;
				</li>
				{#if LEGAL.emailProvider}
					<li>invio delle email di servizio: {LEGAL.emailProvider};</li>
				{/if}
			</ul>
		</li>
		<li>
			<strong>Google</strong>, solo se scegli "Continua con Google": in quel caso Google sa che hai
			effettuato l'accesso a Splitto, secondo la sua
			<a href="https://policies.google.com/privacy" rel="noopener">informativa privacy</a>.
		</li>
		<li>
			<strong>I servizi di notifica del tuo browser</strong> (ad esempio Google per Chrome e Android,
			Apple per Safari e iPhone, Mozilla per Firefox), solo se attivi le notifiche: ricevono le notifiche
			in forma cifrata e le consegnano al tuo dispositivo.
		</li>
		<li>Autorità pubbliche, solo se previsto dalla legge.</li>
	</ul>

	<h2>5. Trasferimenti fuori dall'Unione europea</h2>
	<p>
		Alcuni fornitori (Cloudflare, Google, i servizi di notifica) hanno sede negli Stati Uniti. In
		questi casi il trasferimento avviene sulla base del EU-U.S. Data Privacy Framework o delle
		clausole contrattuali standard approvate dalla Commissione europea.
	</p>

	<h2>6. Per quanto tempo conserviamo i dati</h2>
	<ul>
		<li>
			<strong>Account e contenuti</strong>: finché il tuo account esiste. Le spese che sposti nel
			cestino restano lì finché tu o un altro membro non le ripristinate.
		</li>
		<li><strong>Sessioni di accesso</strong>: 30 giorni dall'ultimo utilizzo, poi scadono.</li>
		<li><strong>Link per reimpostare la password</strong>: 1 ora.</li>
		<li>
			<strong>Indirizzi IP per il limite dei tentativi</strong>: solo in memoria, al massimo per
			un'ora.
		</li>
		<li><strong>Log del server</strong>: circa 14 giorni.</li>
		<li>
			<strong>Backup</strong>: ogni copia viene cancellata automaticamente dopo al massimo 5
			settimane. Per questo, dopo l'eliminazione dell'account, i tuoi dati possono restare nei
			backup fino a quel momento.
		</li>
	</ul>
	<h3>Cosa succede quando elimini l'account</h3>
	<p>
		Eliminiamo subito account, foto del profilo, sessioni, collegamento a Google e dispositivi per
		le notifiche. Le spese che hai condiviso con altre persone fanno parte anche dei loro conti:
		restano nei gruppi, con il tuo nome come ex membro, perché gli altri possano continuare a vedere
		lo storico e i saldi corretti.
	</p>

	<h2>7. Cookie e dati salvati sul tuo dispositivo</h2>
	<p>
		Splitto usa <strong>solo cookie tecnici</strong>, necessari per farlo funzionare: per questo non
		ti chiediamo il consenso con un banner. Non ci sono cookie di profilazione, di analisi o di
		terze parti.
	</p>
	<div class="overflow-x-auto">
		<table>
			<thead>
				<tr><th>Nome</th><th>A cosa serve</th><th>Durata</th></tr>
			</thead>
			<tbody>
				<tr>
					<td><code>splitto_session</code></td>
					<td>ti mantiene connesso</td>
					<td>30 giorni dall'ultimo utilizzo</td>
				</tr>
				<tr>
					<td><code>splitto_oauth</code></td>
					<td>protegge l'accesso con Google</td>
					<td>10 minuti</td>
				</tr>
			</tbody>
		</table>
	</div>
	<p>
		Nella memoria del browser salviamo anche il tema scelto, la preferenza sulle animazioni e se hai
		chiuso l'avviso sulle notifiche. Se installi Splitto o lo usi offline, il browser conserva una
		copia delle pagine dei tuoi gruppi per consultarle senza connessione: viene cancellata quando
		esci dall'account.
	</p>

	<h2>8. I tuoi diritti</h2>
	<p>In qualsiasi momento puoi:</p>
	<ul>
		<li><strong>accedere</strong> ai tuoi dati e riceverne una copia;</li>
		<li><strong>correggerli</strong>: nome e foto si modificano dal profilo;</li>
		<li>
			<strong>cancellarli</strong>: dal profilo, con "Elimina account" (nei limiti descritti al
			punto 6);
		</li>
		<li>
			<strong>portarli altrove</strong>: puoi esportare le spese di ogni gruppo in formato CSV, o
			chiederci tutti i tuoi dati in un formato leggibile;
		</li>
		<li><strong>limitare</strong> il trattamento od <strong>opporti</strong> ad esso;</li>
		<li><strong>revocare il consenso</strong> alle notifiche push, dal profilo o dal browser.</li>
	</ul>
	<p>
		Per esercitare i tuoi diritti scrivi a <a href="mailto:{LEGAL.contactEmail}"
			>{LEGAL.contactEmail}</a
		>: rispondiamo entro un mese. Se ritieni che i tuoi dati siano trattati in modo non corretto,
		puoi presentare reclamo al
		<a href="https://www.garanteprivacy.it" rel="noopener"
			>Garante per la protezione dei dati personali</a
		>.
	</p>

	<h2>9. Sicurezza</h2>
	<p>
		Il sito usa solo connessioni cifrate (HTTPS), le password sono protette con Argon2, i codici di
		sessione sono salvati in forma non riutilizzabile e ogni gruppo è visibile solo ai suoi membri.
		Facciamo backup regolari per non perdere i dati.
	</p>

	<h2>10. Minori</h2>
	<p>
		Splitto non è pensato per chi ha meno di 14 anni. Se hai meno di 14 anni, puoi usarlo solo con
		il consenso di un genitore.
	</p>

	<h2>11. Modifiche a questa informativa</h2>
	<p>
		Se cambiamo il modo in cui trattiamo i dati, aggiorniamo questa pagina e la data in alto. Per le
		modifiche importanti ti avvisiamo anche nell'app.
	</p>
</main>

<footer class="border-t border-line py-8 text-center text-sm text-ink-muted">
	<a href="/" class="hover:text-ink">Torna alla home</a>
</footer>

<style>
	.legal :global(h2) {
		margin-top: 2.5rem;
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.01em;
	}
	.legal :global(h3) {
		margin-top: 1.5rem;
		font-weight: 700;
	}
	.legal :global(p),
	.legal :global(ul),
	.legal :global(table) {
		margin-top: 0.75rem;
		line-height: 1.65;
	}
	.legal :global(ul) {
		padding-left: 1.25rem;
		list-style: disc;
	}
	.legal :global(li + li) {
		margin-top: 0.35rem;
	}
	.legal :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.925rem;
	}
	.legal :global(th),
	.legal :global(td) {
		border-bottom: 1px solid var(--color-line);
		padding: 0.5rem 0.75rem 0.5rem 0;
		text-align: left;
		vertical-align: top;
	}
	.legal :global(code) {
		font-size: 0.85em;
	}
</style>
