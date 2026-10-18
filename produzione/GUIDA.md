# Mettere Splitto online — guida passo passo

Questa guida porta Splitto da zero a online su un server Linux con **Node.js + PM2 + nginx (solo HTTP)**, con **Cloudflare** davanti che fornisce l'HTTPS.
È scritta per **Ubuntu 24.04 / Debian 12**, ma va bene per qualsiasi distribuzione simile.

Nei comandi sostituisci sempre:

| Segnaposto            | Esempio                                               |
| --------------------- | ----------------------------------------------------- |
| `splitto.example.com` | il tuo dominio                                        |
| `TUO_IP`              | l'IP pubblico del server                              |
| `/opt/splitto`        | la cartella dove installi l'app (puoi lasciarla così) |

File in questa cartella:

| File                              | A cosa serve                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `ecosystem.config.cjs`            | configurazione PM2                                                       |
| `nginx/splitto.conf`              | nginx in **solo HTTP** (porta 80) dietro Cloudflare                      |
| `nginx/aggiorna-ip-cloudflare.sh` | scarica gli IP di Cloudflare e genera i due file usati da `splitto.conf` |
| `splitto.service`                 | alternativa a PM2 con systemd (facoltativa)                              |

Come passa una richiesta:

```
Browser ──HTTPS──▶ Cloudflare ──HTTP:80──▶ nginx ──▶ Node (PM2, 127.0.0.1:3000)
```

nginx accetta connessioni **solo dagli IP di Cloudflare**: chi prova a raggiungere direttamente
`TUO_IP` non ottiene risposta. L'IP reale del visitatore arriva nell'header `CF-Connecting-IP`.

---

## 0. Prima di iniziare

- Un server (VPS) con almeno **1 GB di RAM** e accesso SSH come utente con `sudo`.
- Un dominio gestito su **Cloudflare** (anche con il piano gratuito).

## 1. Preparare il server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential nginx sqlite3 ufw

# Firewall: solo SSH e HTTP (l'HTTPS lo gestisce Cloudflare). La porta 3000 di Node NON va aperta.
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx HTTP'
sudo ufw enable
sudo ufw status
```

## 2. Installare Node.js 24 LTS e PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # v24.x
npm -v       # 11.x

sudo npm install -g pm2
pm2 -v
```

## 3. Creare un utente dedicato e copiare il progetto

L'app gira con un utente senza privilegi chiamato `splitto`.

```bash
sudo adduser --system --group --home /opt/splitto --shell /bin/bash splitto
```

**Opzione A — da un repository git:**

```bash
sudo -u splitto git clone <URL-DEL-REPOSITORY> /opt/splitto
```

**Opzione B — dal tuo computer, senza git** (lancialo sul **tuo computer**, dalla cartella del progetto):

```bash
rsync -avz --delete \
  --exclude node_modules --exclude build --exclude .svelte-kit \
  --exclude data --exclude backups --exclude logs --exclude .env \
  --exclude test-results --exclude playwright-report \
  ./ utente@TUO_IP:/tmp/splitto/
# poi sul server:
sudo rsync -a /tmp/splitto/ /opt/splitto/ && sudo chown -R splitto:splitto /opt/splitto
```

Da qui in poi i comandi si lanciano **come utente `splitto`**:

```bash
sudo -iu splitto
cd /opt/splitto
```

## 4. Installare le dipendenze e configurare `.env`

```bash
npm ci
cp .env.example .env
nano .env
```

Valori da impostare in produzione (gli altri vanno bene così):

```dotenv
ORIGIN=https://splitto.example.com
PORT=3000
ADDRESS_HEADER=X-Real-IP

DATABASE_PATH=./data/splitto.db
UPLOAD_DIR=./data/uploads
UPLOAD_MAX_MB=5
BODY_SIZE_LIMIT=6M

VAPID_SUBJECT=mailto:tua-email@example.com
```

> ⚠️ `ORIGIN` deve essere **esattamente** l'URL pubblico con `https://` (quello che il visitatore
> vede grazie a Cloudflare, anche se nginx parla solo HTTP) e senza `/` finale: serve anche per la
> protezione CSRF. Se è sbagliato, login e form rispondono con errore 403.
>
> `ADDRESS_HEADER=X-Real-IP` fa vedere all'app l'IP reale del visitatore (serve al limite dei
> tentativi di accesso). Senza, tutti sembrerebbero arrivare da nginx.

Genera le chiavi per le notifiche push (vengono scritte in `.env`), poi proteggi il file:

```bash
npm run vapid:generate
chmod 600 .env
```

> Non rigenerare le chiavi VAPID in seguito: le notifiche già attivate dagli utenti smetterebbero di funzionare.

## 5. Build e database

```bash
npm run build
npm run db:migrate          # crea data/splitto.db (lo farebbe anche l'avvio dell'app)
mkdir -p logs backups
```

Non lanciare `npm run db:seed` in produzione: crea utenti demo con una password nota.

## 6. Avviare l'app con PM2

```bash
pm2 start produzione/ecosystem.config.cjs
pm2 status                  # "splitto" deve essere "online"
curl -I http://127.0.0.1:3000/   # deve rispondere HTTP/1.1 200
```

Riavvio automatico dopo un reboot del server:

```bash
pm2 save
pm2 startup systemd -u splitto --hp /opt/splitto
# PM2 stampa un comando che inizia con "sudo env PATH=..."
# Esci dall'utente splitto (exit) e lancia quel comando con il tuo utente sudo.
```

Rotazione dei log di PM2, così non riempiono il disco:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

## 7. nginx (solo HTTP, dietro Cloudflare)

Torna al tuo utente con `sudo` (`exit`).

**7.1 — Genera i file con gli IP di Cloudflare** (servono a nginx per riconoscere Cloudflare e leggere l'IP reale):

```bash
sudo /opt/splitto/produzione/nginx/aggiorna-ip-cloudflare.sh
# crea /etc/nginx/snippets/cloudflare-realip.conf e cloudflare-allow.conf
```

Gli IP di Cloudflare cambiano raramente, ma conviene aggiornarli una volta al mese (`sudo crontab -e`):

```cron
0 4 1 * * /opt/splitto/produzione/nginx/aggiorna-ip-cloudflare.sh >> /var/log/cloudflare-ip.log 2>&1
```

Lo script rimette i file precedenti se nginx rifiuta quelli nuovi, così non resti mai senza sito.

**7.2 — Attiva la configurazione del sito:**

```bash
sudo cp /opt/splitto/produzione/nginx/splitto.conf /etc/nginx/sites-available/splitto
sudo sed -i 's/splitto.example.com/IL-TUO-DOMINIO/g' /etc/nginx/sites-available/splitto
sudo ln -sf /etc/nginx/sites-available/splitto /etc/nginx/sites-enabled/splitto
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
curl -I -H "Host: IL-TUO-DOMINIO" http://127.0.0.1/    # dal server stesso: HTTP/1.1 200
```

## 8. Cloudflare

Nel pannello di Cloudflare, per il tuo dominio:

1. **DNS** → aggiungi un record **A** con nome `@` (o un sottodominio, es. `splitto`) e valore `TUO_IP`, con la **nuvola arancione attiva** ("Proxied").
   Se il server ha IPv6 aggiungi anche un record **AAAA**.
2. **SSL/TLS → Overview** → modalità **Flexible** (Cloudflare ↔ visitatore in HTTPS, Cloudflare ↔ server in HTTP).
3. **SSL/TLS → Edge Certificates** → attiva **Always Use HTTPS**.
   Facoltativo: attiva **HSTS** dopo aver verificato che tutto funzioni.
4. **Speed / Optimization** → **disattiva Rocket Loader**: riscrive gli script e viola la Content Security Policy dell'app (pagina bianca o pulsanti che non rispondono).
5. **Scrape Shield** → **disattiva Email Address Obfuscation**: inserisce uno script che la CSP blocca.
6. Se attivi **Web Analytics**, scegli l'installazione manuale e non l'iniezione automatica dello script, che la CSP bloccherebbe.
7. **Caching** → non creare regole "Cache Everything" sul dominio: le pagine `/app` contengono dati personali.
   L'app manda già gli header giusti: `service-worker.js` non viene messo in cache e gli asset in `/_app/immutable/` sì.

> Con la modalità Flexible il tratto tra Cloudflare e il server viaggia in chiaro. Per questo nginx
> accetta solo connessioni dagli IP di Cloudflare. **Non** impostare la modalità "Full": il server
> non ha HTTPS e Cloudflare mostrerebbe l'errore 525/526.

## Verifiche finali

```bash
curl -I http://IL-TUO-DOMINIO/                    # 301 verso https (redirect fatto da Cloudflare)
curl -I https://IL-TUO-DOMINIO/                   # 200, con content-security-policy e "server: cloudflare"
curl -I https://IL-TUO-DOMINIO/service-worker.js  # cache-control: no-cache, no-store, must-revalidate
curl -I https://IL-TUO-DOMINIO/manifest.webmanifest
curl -m 5 -I -H "Host: IL-TUO-DOMINIO" http://TUO_IP/   # da fuori, senza Cloudflare: nessuna risposta
```

Dal browser:

1. apri `https://IL-TUO-DOMINIO`, registrati e crea un gruppo;
2. carica la foto di uno scontrino (verifica che i limiti di upload siano a posto);
3. nel profilo attiva le notifiche: arriva subito “🔔 Notifiche attive”;
4. su Chrome o Android compare “Installa”; su iPhone le istruzioni “Condividi → Aggiungi alla schermata Home”;
5. apri la console del browser (F12): non devono esserci errori "Content Security Policy".

Per controllare che l'IP reale arrivi a nginx: `sudo tail -3 /var/log/nginx/splitto.access.log` deve mostrare il tuo IP, non quelli di Cloudflare.

## 9. Backup automatici ogni notte

Come utente `splitto`:

```bash
sudo -iu splitto
cd /opt/splitto && npm run backup      # prova manuale
crontab -e
```

Aggiungi questa riga (ogni notte alle 3:30):

```cron
30 3 * * * cd /opt/splitto && /usr/bin/npm run backup >> /opt/splitto/backups/cron.log 2>&1
```

I backup finiscono in `/opt/splitto/backups`. **Copiali anche fuori dal server** (almeno ogni tanto), per esempio dal tuo computer:

```bash
rsync -avz utente@TUO_IP:/opt/splitto/backups/ ./backup-splitto/
```

Ripristino (ferma prima l'app):

```bash
pm2 stop splitto
npm run restore -- backups/splitto-AAAA-MM-GG_hh-mm-ss.tar.gz
pm2 start splitto
```

## 10. Pubblicare un aggiornamento

```bash
sudo -iu splitto
cd /opt/splitto
npm run backup                  # sempre prima di aggiornare
git pull                        # oppure il nuovo rsync del punto 3
npm ci
npm run build
pm2 reload splitto              # le migrazioni del database si applicano all'avvio
pm2 logs splitto --lines 50     # controlla che non ci siano errori
```

Gli utenti con l'app aperta vedono il banner **“È disponibile una nuova versione di Splitto — Aggiorna”**: non serve fare altro.
Non mettere in cache `service-worker.js` su CDN o proxy (la configurazione nginx fornita lo impedisce già).

**Tornare alla versione precedente** (se l'aggiornamento ha problemi):

```bash
git log --oneline -5            # trova il commit precedente
git checkout <commit>
npm ci && npm run build
pm2 reload splitto
# se la nuova versione aveva modificato il database:
pm2 stop splitto && npm run restore -- backups/<backup-fatto-prima-dell-aggiornamento> && pm2 start splitto
```

## 11. Comandi PM2 utili

| Comando                                  | A cosa serve                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `pm2 status`                             | stato dei processi                                                     |
| `pm2 logs splitto`                       | log in tempo reale (`--lines 200` per lo storico)                      |
| `pm2 logs splitto --err`                 | solo gli errori                                                        |
| `pm2 monit`                              | CPU e memoria in tempo reale                                           |
| `pm2 show splitto`                       | dettagli: percorsi, riavvii, uptime                                    |
| `pm2 reload splitto`                     | riavvia dopo un aggiornamento                                          |
| `pm2 restart splitto --update-env`       | riavvia e rilegge le variabili d'ambiente                              |
| `pm2 stop splitto` / `pm2 start splitto` | ferma / avvia                                                          |
| `pm2 delete splitto`                     | rimuove l'app da PM2 (poi `pm2 start produzione/ecosystem.config.cjs`) |
| `pm2 save`                               | salva la lista dei processi per il riavvio del server                  |
| `pm2 flush`                              | svuota i log                                                           |

Il file `.env` viene letto da Node all'avvio (`--env-file=.env`): dopo una modifica basta `pm2 restart splitto`.

> Splitto usa SQLite e un job interno per le spese ricorrenti: deve girare **una sola istanza**.
> Non usare `pm2 scale` né il cluster mode (`-i max`).

## 12. Comandi utili per nginx, log e database

```bash
sudo nginx -t                                  # controlla la configurazione
sudo systemctl reload nginx                    # applica le modifiche senza interruzioni
sudo tail -f /var/log/nginx/splitto.error.log  # errori di nginx
sudo tail -f /var/log/nginx/splitto.access.log # richieste
sudo cat /etc/nginx/snippets/cloudflare-allow.conf | head -2   # data dell'ultimo aggiornamento IP
df -h /opt/splitto                             # spazio su disco
du -sh /opt/splitto/data /opt/splitto/backups  # quanto occupano dati e backup
sqlite3 /opt/splitto/data/splitto.db "PRAGMA integrity_check;"   # deve rispondere "ok"
```

## 13. Risoluzione dei problemi

| Sintomo                                                    | Causa probabile                                                              | Soluzione                                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **502 Bad Gateway** (pagina di nginx)                      | l'app non è in esecuzione                                                    | `pm2 status`, `pm2 logs splitto --err`                                                                |
| **521 / 522** (pagina di Cloudflare)                       | Cloudflare non raggiunge nginx sulla porta 80                                | `sudo systemctl status nginx`, `sudo ufw status` (serve "Nginx HTTP"), record DNS con l'IP giusto     |
| **525 / 526**                                              | modalità SSL di Cloudflare su "Full"                                         | imposta **Flexible** (il server parla solo HTTP)                                                      |
| **ERR_TOO_MANY_REDIRECTS**                                 | un redirect verso https sul server, insieme alla modalità Flexible           | non aggiungere redirect in nginx: lo fa Cloudflare con "Always Use HTTPS"                             |
| Pagina bianca, errori "Content Security Policy" in console | Rocket Loader o Email Obfuscation di Cloudflare                              | disattivali (punto 8)                                                                                 |
| Il sito non risponde anche se nginx è attivo               | snippet IP mancanti o IP di Cloudflare cambiati                              | `sudo /opt/splitto/produzione/nginx/aggiorna-ip-cloudflare.sh`                                        |
| **403** su login o form                                    | `ORIGIN` diverso dall'URL reale                                              | correggi `.env` (https, nessuna `/` finale), `pm2 restart splitto`                                    |
| **413 Request Entity Too Large**                           | upload oltre il limite di nginx                                              | `client_max_body_size` in nginx ≥ `BODY_SIZE_LIMIT`                                                   |
| Upload che falliscono senza 413                            | `BODY_SIZE_LIMIT` mancante (adapter-node accetta di default solo 512K)       | `BODY_SIZE_LIMIT=6M` in `.env`, poi restart                                                           |
| Rate limit che blocca tutti insieme                        | l'app non vede l'IP reale                                                    | `ADDRESS_HEADER=X-Real-IP` in `.env`, poi `pm2 restart splitto`                                       |
| `SQLITE_CANTOPEN` / permessi                               | cartella `data` non scrivibile                                               | `sudo chown -R splitto:splitto /opt/splitto`                                                          |
| Notifiche push che non arrivano                            | chiavi VAPID mancanti o sito non in HTTPS                                    | `npm run vapid:generate` (solo la prima volta), restart; su iPhone serve l'app installata (iOS 16.4+) |
| Utenti fermi su una versione vecchia                       | `service-worker.js` messo in cache da Cloudflare (regola "Cache Everything") | rimuovi la regola; Cloudflare → Caching → Purge Everything                                            |
| Il pulsante “Installa” non compare                         | il sito non è in HTTPS o il manifest non si carica                           | controlla `curl -I https://…/manifest.webmanifest` e che il record DNS sia "Proxied"                  |
| `npm ci` fallisce con `edgesOut`                           | npm 10                                                                       | con Node 24 c'è già npm 11; altrimenti `npx npm@11 ci`                                                |

## Alternativa a PM2: systemd

Se preferisci non usare PM2, `splitto.service` avvia l'app direttamente con systemd:

```bash
sudo cp /opt/splitto/produzione/splitto.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now splitto
sudo systemctl status splitto
journalctl -u splitto -f          # log
sudo systemctl restart splitto    # dopo un aggiornamento
```

Usa **o** PM2 **o** systemd, non entrambi.
