# Attivare "Continua con Google" in produzione

Cosa fare sul server (e nella console di Google) dopo l'aggiornamento che aggiunge l'accesso con
Google. Per l'installazione completa vedi [GUIDA.md](GUIDA.md).

Nei comandi sostituisci `splitto.example.com` con il tuo dominio.

**In breve:**

1. crei le credenziali OAuth su Google Cloud;
2. aggiorni il codice sul server e aggiungi due righe a `.env`;
3. riavvii e controlli che il login funzioni.

Finché le due variabili non sono impostate il pulsante non compare: puoi pubblicare il codice
anche prima di aver finito la parte su Google.

---

## 1. Prima di iniziare

- [ ] Il sito è già online in **https** sul dominio definitivo (Google non accetta redirect in http,
      tranne `localhost`).
- [ ] In `.env` `ORIGIN` è **esattamente** `https://splitto.rizzolo.cloud` (senza `/` finale): l'indirizzo
      di ritorno da Google viene costruito da qui.
- [ ] Un account Google con cui gestire il progetto (meglio non quello personale di tutti i giorni).

## 2. Configurare Google Cloud (una volta sola)

Vai su <https://console.cloud.google.com> → in alto **Seleziona progetto → Nuovo progetto**
(es. "Splitto") e selezionalo.

### 2.1 Schermata di consenso ("Google Auth Platform")

Menu → **API e servizi → Schermata consenso OAuth** (oppure "Google Auth Platform") → **Inizia**:

| Campo                         | Valore       |
| ----------------------------- | ------------ |
| Nome app                      | `Splitto`    |
| Email di assistenza utenti    | la tua email |
| Pubblico (Audience)           | **Esterno**  |
| Dati di contatto sviluppatore | la tua email |

Poi, nella sezione **Branding**:

- **Home page dell'applicazione**: `https://splitto.rizzolo.cloud`
- **Link alle norme sulla privacy**: `https://splitto.rizzolo.cloud/privacy` (vedi la nota sotto)
- **Domini autorizzati**: `splitto.example.com` (solo il dominio, senza `https://`)
- **Logo**: meglio **non caricarlo** per ora: con il logo Google chiede la verifica del brand, che
  richiede giorni. Senza logo il login funziona lo stesso.

Nella sezione **Accesso ai dati (Data Access / Ambiti)** non serve aggiungere nulla: Splitto chiede
solo `openid`, `email` e `profile`, che sono ambiti di base e **non richiedono verifica**.

> ⚠️ **Pagina privacy**: prima di pubblicare compila i campi `TODO` in `src/lib/legal.ts`
> (titolare, email di contatto, fornitore del server), altrimenti `/privacy` li mostra così come
> sono.

### 2.2 Pubblicare l'app (passaggio da non dimenticare)

Sezione **Pubblico (Audience)** → **Stato di pubblicazione** → **Pubblica app** → conferma.
Lo stato deve diventare **In produzione**.

Se resta **In test**, possono accedere solo gli indirizzi aggiunti in "Utenti di test" e tutti gli
altri vedono l'errore `403: access_denied`.

### 2.3 Creare le credenziali

Sezione **Client** (o **Credenziali → Crea credenziali → ID client OAuth**):

| Campo                               | Valore                                                |
| ----------------------------------- | ----------------------------------------------------- |
| Tipo di applicazione                | **Applicazione web**                                  |
| Nome                                | `Splitto produzione`                                  |
| Origini JavaScript autorizzate      | `https://splitto.rizzolo.cloud`                       |
| URI di reindirizzamento autorizzati | `https://splitto.rizzolo.cloud/login/google/callback` |

L'URI deve coincidere **carattere per carattere** (https, niente `www` se non lo usi, niente `/`
finale). Se usi anche `www.splitto.example.com`, il sito deve comunque rispondere su un solo
dominio, quello di `ORIGIN`.

Premi **Crea** e copia **ID client** e **Client secret**. Il secret si vede per intero solo ora:
salvalo in un password manager.

> Per provare in locale crea un **secondo** client OAuth con redirect
> `http://localhost:5173/login/google/callback` e mettilo nel `.env` del tuo computer. Non usare
> le credenziali di produzione in sviluppo.

## 3. Aggiornare il server

```bash
sudo -iu splitto
cd /opt/splitto
npm run backup                  # sempre prima di aggiornare
git pull                        # oppure rsync, come al punto 3 di GUIDA.md
npm ci                          # installa la nuova dipendenza "arctic"
```

Aggiungi a `.env` (con `nano .env`):

```dotenv
GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Poi:

```bash
chmod 600 .env                  # il secret non deve essere leggibile da altri utenti
npm run build
pm2 restart splitto --update-env   # restart (non reload): rilegge .env
pm2 logs splitto --lines 50        # nessun errore all'avvio
```

All'avvio viene applicata la migrazione `0002_oauth_accounts`: **aggiunge solo** la tabella
`oauth_accounts`, non tocca utenti, gruppi o spese.

## 4. Verifiche

```bash
curl -sI https://splitto.rizzolo.cloud/login/google | grep -i location
# deve puntare a https://accounts.google.com/... con
# redirect_uri=https%3A%2F%2Fsplitto.example.com%2Flogin%2Fgoogle%2Fcallback
```

Dal browser (meglio in una finestra anonima):

- [ ] su `/login` e `/register` compare **"Continua con Google"**;
- [ ] con un account Google **nuovo**: si entra, si vede la pagina di benvenuto e nel profilo
      compare **"Imposta una password"**;
- [ ] esci e rientra con Google: ritrovi lo stesso account (non ne viene creato un secondo);
- [ ] con un account Google la cui email è **già registrata** con password: entri nell'account
      esistente, con i suoi gruppi;
- [ ] da un **link di invito** a un gruppo, "Continua con Google" riporta all'invito;
- [ ] premendo "Annulla" sulla pagina di Google torni a `/login` con "Accesso annullato".

## 5. Se qualcosa non va

| Sintomo                                                   | Causa probabile                                                  | Soluzione                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Il pulsante non compare                                   | variabili mancanti o app non riavviata                           | controlla `.env`, poi `pm2 restart splitto --update-env`                            |
| Google mostra **`redirect_uri_mismatch`**                 | URI nella console diverso da quello inviato                      | confronta con il `redirect_uri` del `curl` sopra; correggi la console o `ORIGIN`    |
| Google mostra **`403: access_denied`**                    | app ancora "In test"                                             | punto 2.2: pubblica l'app                                                           |
| Torni su `/login` con "Non è stato possibile completare…" | secret sbagliato, oppure il cookie temporaneo è scaduto (10 min) | `pm2 logs splitto --err` mostra `[oauth] google code exchange failed` con il motivo |
| "…non ha fornito un'email verificata"                     | account Google senza email verificata (raro)                     | l'utente si registra con email e password                                           |
| `invalid_client`                                          | ID client o secret copiati male (spazi, caratteri mancanti)      | ricopiali, poi restart                                                              |

## 6. Manutenzione

- **Cambiare il secret** (se pensi sia stato esposto): nella console di Google, nel client,
  **Aggiungi secret** → aggiorna `.env` → `pm2 restart splitto --update-env` → elimina il vecchio
  secret dalla console.
- **Cambio di dominio**: aggiorna `ORIGIN`, l'origine e l'URI di reindirizzamento del client e i
  domini autorizzati nella schermata di consenso.
- **Disattivare l'accesso con Google**: svuota le due variabili e fai restart. Chi si era
  registrato solo con Google e non ha impostato una password nel profilo resta fuori: potrebbe
  rientrare con **"Password dimenticata?"**, ma oggi le email di Splitto vengono solo scritte nei
  log (`src/lib/server/mailer`), quindi prima va collegato un vero servizio SMTP.
- **Tornare alla versione precedente**: la procedura di GUIDA.md (punto 10) funziona anche senza
  ripristinare il backup, perché la migrazione aggiunge solo una tabella che il vecchio codice
  ignora.
