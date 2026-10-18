# Splitto 🪙

**Dividi le spese, non le amicizie.** Webapp per dividere le spese con amici, coinquilini e compagni di viaggio, ispirata a Splitwise. Interfaccia in italiano, importi **solo in euro**.

- Gruppi, amici (spese 1-a-1), membri **ospiti** che possono rivendicare il profilo, inviti con link e **QR code**
- 6 modalità di divisione (uguale, importi, percentuali, quote, uguale con aggiustamenti, voci di scontrino), **più pagatori**
- Saldi per gruppo, per amico e totali, **debiti sempre semplificati** (il minor numero di pagamenti), rimborsi, promemoria, feed attività
- Spese ricorrenti, statistiche, budget, ricerca e filtri, CSV, riepilogo per WhatsApp, cestino con “Annulla”
- PWA installabile, consultazione offline, notifiche push, animazioni 3D (Threlte) leggere e disattivabili

Piano e schema del database: [docs/PLAN.md](docs/PLAN.md).

---

## Requisiti

- **Node.js ≥ 22.12** (consigliato 24 LTS) — `better-sqlite3` e `@node-rs/argon2` usano binari precompilati
- **npm ≥ 11** (con npm 10 l'installazione può fallire con `Cannot read properties of null (reading 'edgesOut')`: usa `npx npm@11 install`)
- Linux, macOS o Windows. Nessun database esterno: SQLite su file.

## Setup in locale

```bash
npm install
cp .env.example .env
npm run vapid:generate     # chiavi per le notifiche push (scritte in .env)
npm run db:migrate         # crea data/splitto.db
npm run db:seed            # dati demo
npm run dev                # http://localhost:5173
```

Utenti demo (password `splitto-demo`): `marco@splitto.test`, `giulia@splitto.test`, `luca@splitto.test`, `sara@splitto.test`.
`npm run db:seed -- --reset` svuota il database e lo ripopola.

## Variabili d'ambiente

Tutte documentate in [`.env.example`](.env.example).

| Variabile                                                | Default                 | Descrizione                                                                                                                           |
| -------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ORIGIN`                                                 | `http://localhost:5173` | URL pubblico. Usato per link di invito/reset **e** per il controllo CSRF di adapter-node: in produzione deve essere l'URL https reale |
| `PORT`                                                   | `3000`                  | Porta del server di produzione                                                                                                        |
| `ADDRESS_HEADER`                                         | —                       | `X-Real-IP` dietro nginx + Cloudflare, per vedere l'IP reale (rate limiting)                                                          |
| `DATABASE_PATH`                                          | `./data/splitto.db`     | File SQLite (la cartella viene creata)                                                                                                |
| `DB_AUTO_MIGRATE`                                        | `true`                  | Applica le migrazioni all'avvio                                                                                                       |
| `UPLOAD_DIR`                                             | `./data/uploads`        | Scontrini e avatar (inclusi nei backup)                                                                                               |
| `UPLOAD_MAX_MB`                                          | `5`                     | Dimensione massima di un upload                                                                                                       |
| `BODY_SIZE_LIMIT`                                        | `6M`                    | Limite del body di adapter-node (di default 512K: troppo poco per le foto)                                                            |
| `SESSION_DAYS`                                           | `30`                    | Durata della sessione (rinnovata automaticamente con l'uso)                                                                           |
| `COOKIE_SECURE`                                          | `true` in produzione    | Mettere `false` solo per test su HTTP non-localhost                                                                                   |
| `RATE_LIMIT_SCALE`                                       | `1`                     | Moltiplica i limiti di login/registrazione (i test E2E usano 100)                                                                     |
| `JOBS_ENABLED`                                           | `true`                  | Job interno che genera le spese ricorrenti                                                                                            |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | —                       | Web Push (`npm run vapid:generate`)                                                                                                   |
| `PUBLIC_SW_IN_DEV`                                       | `false`                 | Attiva il service worker anche con `npm run dev`                                                                                      |
| `BACKUP_DIR`, `BACKUP_KEEP_DAILY`, `BACKUP_KEEP_WEEKLY`  | `./backups`, `7`, `4`   | Backup e rotazione                                                                                                                    |

## Comandi

| Comando                                        | Descrizione                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                                  | Server di sviluppo (service worker disattivato)                                   |
| `npm run build`                                | Build di produzione in `build/`                                                   |
| `npm start`                                    | Avvia la build con adapter-node (legge `.env`)                                    |
| `npm run check`                                | Type check (svelte-check, TypeScript strict)                                      |
| `npm run lint` / `npm run format`              | Prettier + ESLint                                                                 |
| `npm run test:unit`                            | Test unitari (Vitest) — dominio, servizi, rotazione backup                        |
| `npm run test:e2e`                             | Test end-to-end (Playwright; alla prima volta: `npx playwright install chromium`) |
| `npm test`                                     | Unitari + E2E                                                                     |
| `npm run db:generate`                          | Nuova migrazione dopo una modifica a `schema.ts`                                  |
| `npm run db:migrate`                           | Applica le migrazioni                                                             |
| `npm run db:seed`                              | Dati demo                                                                         |
| `npm run db:studio`                            | Drizzle Studio                                                                    |
| `npm run vapid:generate`                       | Genera le chiavi VAPID                                                            |
| `npm run icons`                                | Rigenera le icone PWA da `scripts/icon.svg`                                       |
| `npm run screenshots`                          | Rigenera gli screenshot del manifest (con `npm run dev` attivo e dati demo)       |
| `npm run backup` / `npm run restore -- <file>` | Backup e ripristino                                                               |

## Struttura del progetto

```
src/
├─ hooks.server.ts          sessione → locals, protezione /app, header di sicurezza, avvio job
├─ service-worker.ts        cache versionate, offline, push
├─ lib/
│  ├─ domain/               logica pura (client + server), con test: denaro, divisioni, saldi,
│  │                        semplificazione, date, categorie, riepiloghi
│  ├─ server/
│  │  ├─ db/                schema Drizzle, client SQLite (WAL, foreign keys, busy_timeout)
│  │  ├─ auth/              password argon2, sessioni nel DB, rate limit, reset password
│  │  ├─ services/          gruppi, inviti, spese, saldi, rimborsi, ricorrenti, statistiche,
│  │  │                     attività, notifiche (ogni funzione verifica l'appartenenza al gruppo)
│  │  ├─ mailer/            interfaccia Mailer (per ora stampa in console)
│  │  ├─ push/              Web Push (VAPID)
│  │  └─ jobs/              job in-process (spese ricorrenti, pulizia sessioni)
│  ├─ components/           ui/, app/, home/, pwa/ (InstallButton, PushToggle…), three/ (3D, lazy)
│  └─ client/               tema, toast, service worker, install, push, condivisione
└─ routes/
   ├─ +page.svelte          home pubblica con esempio interattivo
   ├─ (auth)/               login, register, forgot-password, reset-password/[token]
   ├─ invite/[token]        accetta invito / rivendica profilo ospite
   ├─ offline/              pagina offline (prerenderizzata)
   └─ app/                  area protetta: dashboard, groups, expenses, friends, activity, profile
scripts/                    migrate, seed, backup, restore, vapid, icone, screenshot
drizzle/                    migrazioni SQL versionate
produzione/                 PM2, systemd, nginx e guida alla messa online (GUIDA.md)
tests/e2e/                  Playwright
```

### Scelte principali

- **Denaro in centesimi interi**, mai float. Le divisioni non esatte assegnano i centesimi di resto in modo deterministico (metodo dei resti maggiori, a parità vince l'ordine dei membri): la somma delle quote è sempre uguale al totale.
- **Amicizie = gruppi nascosti** (`kind = 'direct'`) con due membri: stesso codice per spese, saldi e permessi.
- **Le spese referenziano i membri, non gli utenti**: un ospite che si registra “rivendica” il suo membro ed eredita lo storico.
- Le quote calcolate vengono salvate (`expense_shares`); l'input originale (`split_input`) serve per rimodificare la spesa.
- **SvelteKit 2** (vincolo di progetto; `sv create` oggi genera la 3).

## Sicurezza

- Password con **argon2id**, sessioni nel database (nel cookie c'è solo un token, nel DB il suo SHA-256), cookie `httpOnly`, `secure`, `sameSite=lax`, scadenza con rinnovo automatico.
- Rate limiting in memoria su login, registrazione e reset password.
- **Autorizzazione**: ogni pagina, action ed endpoint passa da `requireMembership` / `getExpenseForUser`; un ID di un altro gruppo restituisce 404 (coperto da test unitari ed E2E).
- CSRF: controllo dell'origine di SvelteKit attivo per i form; gli endpoint JSON verificano `Origin`.
- CSP con nonce/hash (`kit.csp`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; pagine `/app` con `Cache-Control: private, no-store`.
- Upload: tipo verificato dai _magic bytes_ (JPG/PNG/WebP, PDF per gli scontrini), dimensione limitata, nomi casuali, scontrini serviti solo ai membri del gruppo.
- Export CSV protetto dalla _formula injection_.

## Deploy su un server Linux

La guida passo passo (server, Node, PM2, nginx, Cloudflare, firewall, backup, aggiornamenti e
risoluzione problemi) è in **[`produzione/GUIDA.md`](produzione/GUIDA.md)**. Nella stessa cartella:

| File                                                                                       | A cosa serve                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| [`produzione/ecosystem.config.cjs`](produzione/ecosystem.config.cjs)                       | configurazione PM2 (consigliata)                                         |
| [`produzione/nginx/splitto.conf`](produzione/nginx/splitto.conf)                           | nginx in solo HTTP dietro Cloudflare (accetta solo gli IP di Cloudflare) |
| [`produzione/nginx/aggiorna-ip-cloudflare.sh`](produzione/nginx/aggiorna-ip-cloudflare.sh) | genera gli snippet nginx con gli IP di Cloudflare                        |
| [`produzione/splitto.service`](produzione/splitto.service)                                 | alternativa a PM2 con systemd                                            |

Esegui **una sola istanza** (SQLite e job interni) e tieni il sito dietro Cloudflare con HTTPS: PWA, service worker e notifiche push lo richiedono.

## Rilasciare una nuova versione (senza lasciare utenti bloccati)

```bash
cd /opt/splitto
npm run backup                # sempre, prima di aggiornare
git pull && npm ci && npm run build
pm2 reload splitto            # le migrazioni pendenti si applicano all'avvio
```

Come funziona l'aggiornamento lato utente:

1. Ogni build ha una `version` nuova: il service worker crea cache con nome `splitto-cache-<versione>` e, quando si attiva, cancella quelle vecchie.
2. Il nuovo service worker si installa ma **resta in attesa** (niente `skipWaiting()` automatico), così una pagina aperta non mescola file di due versioni.
3. L'app controlla gli aggiornamenti ogni ora, quando torna in primo piano e con `version.pollInterval` di SvelteKit (store `updated`). Appare il banner **“È disponibile una nuova versione di Splitto — Aggiorna”**.
4. Al click il worker riceve `SKIP_WAITING`; su `controllerchange` la pagina si ricarica **una sola volta**. Se c'è un modulo con dati non salvati viene chiesta conferma: l'aggiornamento non interrompe mai l'utente.

Regole per non lasciare nessuno su una versione vecchia:

- non mettere in cache `service-worker.js` su Cloudflare o altri proxy (niente regole "Cache Everything"; vedi `produzione/nginx/splitto.conf`); il browser lo ricontrolla comunque con `updateViaCache: 'none'`;
- non rinominare né spostare `service-worker.js`;
- le migrazioni devono restare compatibili con la versione precedente per il tempo in cui alcuni client hanno ancora il vecchio JavaScript (aggiungere colonne, non rinominarle subito).

## Backup

`npm run backup`:

1. copia il database con l'**API di backup online di SQLite** (`db.backup()`), sicura con WAL attivo e con l'app in esecuzione (mai una semplice copia del file);
2. verifica la copia con `PRAGMA integrity_check` (se fallisce esce con codice di errore);
3. crea `backups/splitto-YYYY-MM-DD_HH-mm-ss.tar.gz` con database e cartella upload;
4. applica la **rotazione**: tiene l'ultimo backup di ciascuno degli ultimi `BACKUP_KEEP_DAILY` giorni e delle ultime `BACKUP_KEEP_WEEKLY` settimane;
5. scrive il log su console e in `backups/backup.log`.

`npm run restore -- backups/splitto-….tar.gz` chiede conferma, avvisa se l'app sembra in esecuzione (porta occupata o database bloccato), verifica l'archivio, fa **prima un backup di sicurezza** dello stato attuale e poi sostituisce database e upload. In modalità non interattiva serve `--yes`.

Destinazioni remote: implementa l'interfaccia `BackupTarget` in [`scripts/lib/backup-core.ts`](scripts/lib/backup-core.ts) (es. S3 o rsync) e aggiungila all'elenco `targets` in `scripts/backup.ts`.

**Ogni notte con cron (Linux)** — `crontab -e` per l'utente `splitto`:

```cron
30 3 * * * cd /opt/splitto && /usr/bin/npm run backup >> /opt/splitto/backups/cron.log 2>&1
```

**Ogni notte con l'Utilità di pianificazione (Windows)** — PowerShell come amministratore:

```powershell
$action  = New-ScheduledTaskAction -Execute "npm.cmd" -Argument "run backup" -WorkingDirectory "C:\splitto"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:30am
Register-ScheduledTask -TaskName "Splitto backup" -Action $action -Trigger $trigger -Description "Backup notturno di Splitto"
```

## PWA, offline e notifiche

- Manifest con icone normali e _maskable_, scorciatoie (“Aggiungi spesa”, “I miei gruppi”) e screenshot; meta tag e icona per iOS.
- Pulsante **Installa** per ogni piattaforma: prompt nativo su Chrome/Edge/Samsung Internet/Opera, istruzioni illustrate per Safari iOS (Condividi → Aggiungi alla schermata Home) e macOS (File → Aggiungi al Dock), Firefox Android e Firefox desktop; diventa “App installata ✓” in modalità standalone.
- Service worker: asset del build _cache-first_; pagine _network-first_ con fallback alla cache e poi a `/offline`. Si salvano solo le pagine dell'utente (dashboard, gruppi, saldi, amici, attività), mai richieste non-GET, autenticazione, inviti, API o file privati; la cache personale si svuota al logout.
- Notifiche Web Push (VAPID): il permesso si chiede solo dal profilo, dopo un click; ogni evento si disattiva dalle preferenze; le sottoscrizioni scadute (404/410) vengono rimosse. Su iPhone servono iOS 16.4+ e l'app installata.

## Accessibilità e prestazioni

- Contrasto WCAG AA (controllato da axe nei test E2E, in tema chiaro e scuro), navigazione da tastiera, focus visibile, etichette ARIA, target touch ≥ 44 px, link “Vai al contenuto”.
- I form funzionano anche senza JavaScript (progressive enhancement); unica eccezione la divisione per voci di scontrino.
- Three.js/Threlte si caricano solo con import dinamico, solo se la scena è visibile, se WebGL è disponibile e se le animazioni non sono ridotte (`prefers-reduced-motion` o “Riduci animazioni” nel profilo). Il render va in pausa fuori schermo o con la scheda nascosta. Il loader di navigazione è una moneta in CSS 3D, così non scarica Three.js.

## Test

- **Unitari** (`npm run test:unit`): parsing degli importi, distribuzione dei centesimi, tutte le modalità di divisione, più pagatori, saldi e debiti tra coppie, semplificazione dei debiti (casi limite + fuzz), date e ricorrenze, categorie, servizi su un database in memoria (autorizzazione, ospiti, inviti, ricorrenti, cestino, promemoria), rotazione dei backup.
- **E2E** (`npm run test:e2e`): registrazione → gruppo → invito → seconda persona si registra dal link → spesa (con validazione live) → rimborso → saldo a zero; protezione degli URL di altri gruppi; home ed esempio interattivo; controlli di accessibilità. Il server di test usa `data/e2e.db`, ricreato a ogni esecuzione.
