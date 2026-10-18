# Progetto: Splitto — webapp per dividere le spese (clone funzionale di Splitwise)

Sei in una cartella **completamente vuota**. Devi creare da zero una webapp completa chiamata **Splitto**, che replica logica e funzionamento di Splitwise e aggiunge alcune funzionalità extra. Lavora per fasi (vedi in fondo). Alla fine di ogni fase il progetto deve compilare, `npm run check` non deve dare errori e i test devono passare. Prima di scrivere codice, mostrami un piano breve con struttura delle cartelle e schema del database, poi procedi.

Lingua dell'interfaccia: **italiano**. Valuta predefinita: **EUR**. Codice e commenti in inglese.

---

## 1. Stack tecnico (vincolante)

- **SvelteKit 2 + Svelte 5 (runes)**, TypeScript in modalità strict.
  - Inizializza con `npx sv create .` in modalità **non interattiva** (controlla `npx sv create --help` per i flag corretti), template minimal, TypeScript.
- **adapter-node** (l'app gira su un server Node, non serverless).
- **Database: SQLite su file `.db`** (percorso configurabile da env, default `./data/splitto.db`).
  - Driver `better-sqlite3`, ORM **Drizzle** con migrazioni versionate (`drizzle-kit`).
  - All'avvio: `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, `PRAGMA busy_timeout = 5000`.
- **Validazione**: zod (o valibot) su tutti gli input lato server.
- **Stile**: Tailwind CSS 4, mobile-first, tema chiaro/scuro (segue il sistema, con toggle manuale).
- **Animazioni 3D**: **Threlte** (Three.js per Svelte) per le scene 3D vere; CSS 3D transforms per le micro-animazioni leggere.
- **Test**: Vitest (unit) + Playwright (end-to-end sui flussi principali).
- Variabili d'ambiente in `.env` con un `.env.example` documentato.

---

## 2. Autenticazione e utenti

Implementa l'autenticazione **a mano** con sessioni su database (niente Lucia, è deprecato; segui l'approccio "sessioni nel DB + cookie"):

- Registrazione con nome, email, password. Password hashate con **argon2** (`@node-rs/argon2`).
- Login / logout, cookie di sessione `httpOnly`, `secure` in produzione, `sameSite=lax`. Sessioni con scadenza e rinnovo automatico (sliding expiration).
- Gestione in `hooks.server.ts`: carica l'utente in `event.locals`, proteggi tutte le rotte sotto `/app`.
- **Rate limiting** su login e registrazione (in memoria va bene) per prevenire attacchi brute force.
- Reset password: genera un token monouso a scadenza. Per ora l'"email" viene stampata in console / log, con un'interfaccia `Mailer` facilmente sostituibile in seguito con un vero SMTP.
- Profilo utente: nome, avatar (upload o iniziali colorate generate), valuta predefinita, preferenze notifiche, cambio password, eliminazione account (consentita solo se i saldi sono a zero, altrimenti avvisa).
- **Autorizzazione rigorosa**: ogni query e ogni action deve verificare che l'utente sia membro del gruppo o parte della spesa. Nessun dato di altri gruppi deve mai essere accessibile cambiando un ID nell'URL.
- Usa form actions di SvelteKit con **progressive enhancement** (`use:enhance`), così tutto funziona anche se il JS è lento a caricare.

---

## 3. Logica di dominio (stile Splitwise)

### Regola fondamentale sul denaro
**Tutti gli importi vanno salvati come interi in centesimi.** Non usare mai float per il denaro. Quando una divisione non è esatta (es. 10 € diviso 3), i centesimi di resto vengono distribuiti in modo deterministico, così la somma delle quote è sempre esattamente uguale al totale. Scrivi test unitari per questo.

### Entità principali
- **Utenti**
- **Amicizie**: spese 1-a-1 fuori dai gruppi, come in Splitwise.
- **Gruppi**: nome, icona/emoji, tipo (casa, viaggio, coppia, altro), valuta del gruppo, membri, admin.
- **Membri "ospiti"**: si può aggiungere al gruppo una persona non ancora registrata (solo nome). Quando quella persona si registra tramite link di invito, può "rivendicare" il proprio profilo ospite e ne eredita lo storico.
- **Inviti**: link di invito con token (con scadenza, revocabile) e **QR code** da mostrare dal vivo.
- **Spese**: descrizione, importo, valuta, data, categoria, chi ha pagato, come si divide, note, foto dello scontrino, commenti.
- **Rimborsi (settle up)**: pagamento registrato da A a B, con metodo (contanti, bonifico, PayPal, Satispay, altro).
- **Feed attività**: chi ha fatto cosa e quando (creazione, modifica, eliminazione, rimborsi, nuovi membri).

### Modalità di divisione (tutte obbligatorie)
1. **In parti uguali**, tra tutti o tra una selezione di membri.
2. **Importi esatti** per persona (la somma deve essere uguale al totale, con validazione in tempo reale e messaggio chiaro su quanto manca o avanza).
3. **Percentuali** (la somma deve fare 100%).
4. **Quote/parti** (es. 2 parti a Marco, 1 a Giulia).
5. **Uguale con aggiustamenti** (parti uguali, più o meno un importo per qualcuno).
6. **Per voci di scontrino**: inserisci le singole voci e assegni ciascuna a una o più persone. Tasse e mancia vengono ripartite in proporzione.

Supporta anche **più pagatori** per una singola spesa (es. Marco ha pagato 30 € e Giulia 20 €).

### Saldi e semplificazione dei debiti
- Calcola i saldi per gruppo, per amico e il **saldo totale** (devi / ti devono).
- **Semplificazione dei debiti** (attivabile o disattivabile per gruppo): algoritmo greedy che riduce al minimo il numero di transazioni (contrapponi il più grande creditore al più grande debitore e ripeti). Deve essere coperto da test unitari con casi limite.
- Mostra "chi deve a chi" in modo chiarissimo, con frasi tipo: "Giulia deve 12,50 € a Marco".

### Altre regole
- Modifica ed eliminazione delle spese consentite a chi le ha create e agli admin. Ogni modifica viene registrata nel feed attività.
- **Soft delete** con possibilità di annullare ("Spesa eliminata — Annulla") per qualche secondo, e cestino ripristinabile nel gruppo.
- **Multi-valuta**: una spesa può essere in una valuta diversa da quella del gruppo. Il tasso di cambio viene salvato sulla spesa al momento dell'inserimento (inserito a mano, con suggerimento precompilato modificabile). I saldi si calcolano nella valuta del gruppo.
- Un membro può uscire dal gruppo, o essere rimosso, solo con saldo a zero.

---

## 4. Funzionalità extra utili

- **Spese ricorrenti** (affitto, bollette, abbonamenti): settimanali, mensili o annuali. Un job lato server le genera alla scadenza e notifica i membri.
- **Promemoria di pagamento**: pulsante "Ricorda a Giulia" che invia una notifica push, con limite (al massimo una volta ogni 24 ore per la stessa persona).
- **Statistiche**: spesa per categoria, andamento mensile, "chi paga di più" nel gruppo, con grafici semplici e animati.
- **Budget di gruppo** opzionale (es. budget del viaggio) con barra di avanzamento e avviso all'80%.
- **Ricerca e filtri** sulle spese (testo, categoria, persona, intervallo di date).
- **Esportazione CSV** delle spese di un gruppo, e **riepilogo condivisibile** (testo pronto da incollare su WhatsApp tramite Web Share API, con fallback sulla copia negli appunti).
- **Categorie con icone** (cibo, casa, trasporti, svago, viaggi, bollette, altro) e suggerimento automatico della categoria in base a parole chiave nella descrizione.
- **Inserimento rapido**: un pulsante "+" sempre visibile (FAB) che apre il form della spesa con il gruppo più recente già selezionato e il cursore sull'importo.
- **Archiviazione dei gruppi** chiusi (es. un viaggio terminato), che restano consultabili.
- **Consultazione offline**: le ultime pagine visitate (gruppi, saldi) sono leggibili anche senza connessione, con un banner "Sei offline — i dati potrebbero non essere aggiornati". Le scritture offline non sono richieste: se manca la rete, mostra un messaggio chiaro.

---

## 5. Animazioni 3D

Obiettivo: un'app "giocosa" ma mai lenta o fastidiosa.

- **Moneta 3D che gira** (Threlte): nella hero della home e come loader. Moneta metallica con il logo "S", rotazione continua con leggero ondeggiamento e riflessi.
- **Portafoglio 3D che si apre** quando si registra un rimborso, con le monete che "volano" dentro.
- **Pioggia di monete / coriandoli** quando un saldo arriva a zero ("Siete pari! 🎉").
- **Micro-animazioni CSS 3D**: card dei gruppi che si inclinano leggermente al passaggio del mouse (tilt), flip della card del saldo (fronte "devi", retro "ti devono"), contatori numerici animati.
- Transizioni tra le pagine con la View Transitions API (con fallback se non supportata).

Requisiti tecnici obbligatori:
- **Lazy loading**: Three.js e Threlte si caricano solo dove servono (import dinamici). Il bundle iniziale delle pagine dell'app non deve includere Three.js.
- Rispetta **`prefers-reduced-motion`**: in quel caso usa versioni statiche o solo dissolvenze. Aggiungi anche un'opzione "Riduci animazioni" nelle impostazioni.
- Metti in pausa il render quando la scena non è visibile (IntersectionObserver / tab nascosta).
- Fallback statico (immagine SVG) se WebGL non è disponibile.

---

## 6. Home page (pagina pubblica, `/`)

Deve far capire **subito** a chiunque cosa fa l'app e come si usa. Struttura:

1. **Hero**: nome "Splitto", slogan breve (es. "Dividi le spese, non le amicizie"), moneta 3D che gira, pulsanti **"Inizia gratis"**, **"Accedi"** e **"Installa"** (vedi sezione 8).
2. **Come funziona in 3 passi**, con illustrazioni animate: crea un gruppo → aggiungi le spese → salda i conti.
3. **Tutte le funzionalità**, in card con icona e una frase ciascuna: gruppi, amici, tutte le modalità di divisione, più pagatori, semplificazione dei debiti, multi-valuta, spese ricorrenti, promemoria, notifiche, statistiche, budget, scontrini, esportazione, uso offline, installabile come app.
4. **Esempio interattivo**: mini-simulazione senza registrazione (es. "Cena da 90 € in 3 persone, Marco ha pagato") che mostra in tempo reale chi deve quanto e l'effetto della semplificazione dei debiti.
5. **FAQ** (è gratis? i miei dati sono al sicuro? posso usarla senza installarla? funziona su iPhone?).
6. Footer.

Se l'utente è già loggato, la home mostra un pulsante "Vai alla dashboard" al posto di "Inizia gratis".

---

## 7. UX dell'app (area `/app`)

- **Dashboard**: saldo totale ben in vista (verde = ti devono, rosso = devi), elenco gruppi e amici con il relativo saldo, attività recenti.
- **Navigazione**: barra in basso su mobile (Dashboard, Gruppi, +, Attività, Profilo), sidebar su desktop.
- **Onboarding** al primo accesso: 3 schermate brevi saltabili, poi la proposta "Crea il tuo primo gruppo".
- **Stati vuoti** curati, con un'illustrazione e un'azione chiara (es. "Nessuna spesa ancora — Aggiungi la prima").
- Messaggi di errore in italiano semplice, vicino al campo interessato. Toast di conferma per le azioni completate.
- Tastierino numerico su mobile per gli importi (`inputmode="decimal"`), accettando sia la virgola sia il punto.
- **Accessibilità**: contrasto WCAG AA, navigazione da tastiera, etichette ARIA, target touch di almeno 44px, focus visibile.
- Le pagine principali devono caricarsi velocemente anche su un telefono di fascia media.

---

## 8. PWA: manifest, pulsante Installa, service worker, notifiche

### Manifest e icone
- `manifest.webmanifest` con nome "Splitto", `display: standalone`, colori del tema, `start_url: /app`, icone 192/512, icone **maskable**, shortcut ("Aggiungi spesa", "I miei gruppi") e screenshot.
- Apple touch icon e meta tag per iOS.

### Pulsante "Installa" (deve funzionare ovunque, nei limiti di ogni piattaforma)
Crea un componente `InstallButton` riutilizzabile, con questo comportamento:
- **Chrome / Edge / Samsung Internet / Opera (desktop e Android)**: intercetta `beforeinstallprompt`, salva l'evento e al click chiama `prompt()`. Gestisci l'esito e l'evento `appinstalled`.
- **Safari su iOS/iPadOS** (non esiste un'API per l'installazione programmatica): al click apri un modale con istruzioni illustrate passo passo: "Tocca Condividi → Aggiungi alla schermata Home".
- **Safari su macOS**: modale con istruzioni "File → Aggiungi al Dock".
- **Firefox Android**: istruzioni tramite il menu del browser. **Firefox desktop** (non supporta l'installazione PWA): spiega che si può usare normalmente nel browser, oppure installarla da Chrome o Edge.
- **App già installata** (`display-mode: standalone` o `navigator.standalone`): nascondi il pulsante oppure mostra "App installata ✓".
- Il rilevamento della piattaforma va fatto lato client, dopo l'idratazione, per evitare problemi di SSR.
- Il pulsante deve essere visibile nella hero della home e richiamabile anche dal profilo.

### Service worker (usa quello nativo di SvelteKit: `src/service-worker.ts`)
- Usa `$service-worker` (`build`, `files`, `version`) e crea cache **versionate** (`splitto-cache-${version}`). In `activate`, elimina tutte le cache delle versioni precedenti.
- Strategie di caching:
  - asset statici con hash del build → **cache-first**;
  - navigazioni HTML → **network-first** con fallback alla cache e infine a una pagina `/offline`;
  - **mai** mettere in cache richieste non-GET, rotte di autenticazione, form actions o risposte con dati personali di altri utenti. I dati dell'utente in cache vanno svuotati al logout.

### Gestione degli aggiornamenti (punto critico, curalo bene)
- **Non** chiamare `skipWaiting()` automaticamente in `install`: rischierebbe di mischiare asset di versioni diverse in una pagina già aperta.
- Quando una nuova versione è in stato `waiting`, mostra un banner non invasivo: **"È disponibile una nuova versione di Splitto — Aggiorna"**.
- Al click: invia `postMessage({ type: 'SKIP_WAITING' })` al worker in attesa. Su `controllerchange` ricarica la pagina **una sola volta** (usa una guardia per evitare loop di reload).
- Se l'utente sta compilando un form, non interromperlo: l'aggiornamento resta proposto finché non decide lui.
- Controlla la presenza di aggiornamenti periodicamente (`registration.update()` ogni ora e al ritorno dell'app in primo piano). Usa anche `version.pollInterval` e lo store `updated` di SvelteKit come segnale aggiuntivo.
- Disabilita il service worker in dev (o rendilo chiaramente disattivabile) per non avere cache "fantasma" durante lo sviluppo.
- Documenta nel README come rilasciare una nuova versione senza lasciare utenti bloccati su quella vecchia.

### Notifiche push
- **Web Push con chiavi VAPID** (libreria `web-push`). Script `npm run vapid:generate` per generare le chiavi e salvarle in `.env`.
- Tabella `push_subscriptions` (un utente può avere più dispositivi). Elimina automaticamente le sottoscrizioni scadute (risposte 404/410).
- Chiedi il permesso **solo dopo un'azione dell'utente** (es. un toggle "Attiva notifiche" nel profilo o un invito contestuale dopo la creazione del primo gruppo), **mai al caricamento della pagina**.
- Eventi che generano una notifica (ognuno disattivabile dalle preferenze): nuova spesa che ti riguarda, spesa modificata, rimborso ricevuto, promemoria di pagamento, invito a un gruppo, spesa ricorrente generata, budget all'80%.
- Al click sulla notifica (`notificationclick`): porta in primo piano la finestra già aperta oppure apri l'URL della spesa o del gruppo corrispondente.
- Nota per iOS: le push funzionano solo se l'app è installata nella schermata Home (iOS 16.4 e successivi). Mostra un messaggio esplicativo agli utenti iOS che non l'hanno installata.

---

## 9. Script di backup (per ora in locale)

Crea `scripts/backup.ts` (eseguibile con `npm run backup`) e `scripts/restore.ts` (`npm run restore -- <file>`):

- Copia del database con l'**API di backup online di SQLite** (`db.backup()` di better-sqlite3) oppure `VACUUM INTO`. **Mai** con una semplice copia del file, che con WAL attivo può produrre backup corrotti.
- Includi nel backup anche la cartella degli upload (scontrini, avatar). Il risultato è un archivio `backups/splitto-YYYY-MM-DD_HH-mm-ss.tar.gz`.
- Dopo il backup, verifica l'integrità con `PRAGMA integrity_check` sulla copia. Se fallisce, esci con codice di errore.
- **Rotazione**: conserva gli ultimi N backup giornalieri e M settimanali (configurabili da env, default 7 e 4).
- Log chiaro su console e su file `backups/backup.log`.
- Lo script di restore chiede conferma, fa prima un backup di sicurezza dello stato attuale e controlla che l'app non sia in esecuzione (o avvisa).
- Nel README: esempio di cron (Linux) e di Utilità di pianificazione (Windows) per eseguirlo ogni notte. Prepara il codice in modo che in futuro si possa aggiungere facilmente una destinazione remota (interfaccia `BackupTarget`).

---

## 10. Qualità, sicurezza e consegna

- Test unitari obbligatori per: calcolo delle quote in tutte le modalità di divisione, distribuzione dei centesimi di resto, saldi, semplificazione dei debiti, conversione di valuta.
- Test E2E Playwright per: registrazione → creazione gruppo → invito → aggiunta spesa → rimborso → saldo a zero.
- Header di sicurezza (CSP compatibile con Threlte e service worker), protezione CSRF (verifica che il controllo origin di SvelteKit sia attivo), upload limitati per tipo e dimensione.
- **Seed** (`npm run db:seed`) con utenti e gruppi demo realistici, per provare subito l'app.
- **README** completo: requisiti, setup, variabili d'ambiente, comandi, struttura del progetto, deploy su server Linux con Node + systemd o PM2, backup, rilascio di nuove versioni.

---

## 11. Fasi di lavoro

1. Setup progetto, Tailwind, Drizzle + SQLite, schema e migrazioni, seed.
2. Autenticazione completa (registrazione, login, sessioni, reset password, profilo).
3. Gruppi, membri, ospiti, inviti con link e QR code.
4. Spese con tutte le modalità di divisione, saldi, semplificazione dei debiti, rimborsi, feed attività (con test unitari).
5. Funzionalità extra (ricorrenti, statistiche, budget, ricerca, esportazione, multi-valuta).
6. Home page pubblica con esempio interattivo.
7. Animazioni 3D e micro-animazioni.
8. PWA: manifest, InstallButton, service worker con gestione aggiornamenti, push.
9. Script di backup e restore.
10. Test E2E, revisione di accessibilità e performance, README.

Alla fine di ogni fase: riassumi cosa hai fatto, cosa resta e come posso provarlo. Se una scelta è ambigua, prendi la decisione più ragionevole, scrivila nel riepilogo e vai avanti.