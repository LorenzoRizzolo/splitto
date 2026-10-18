# Splitto — piano di progetto

## Decisioni principali

| Tema          | Decisione                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework     | SvelteKit **2.70** (il vincolo chiede la v2; `sv create` oggi genera la v3, convertito a mano) + Svelte 5 runes                                  |
| Runtime       | Node ≥ 22.12 (consigliato 24 LTS), `adapter-node`                                                                                                |
| DB            | SQLite (`better-sqlite3`) + Drizzle ORM, migrazioni in `drizzle/`                                                                                |
| ID            | `text` casuali (120 bit, base64url) per non esporre contatori sequenziali                                                                        |
| Denaro        | **solo euro**, interi in centesimi ovunque (multi-valuta rimossa su richiesta)                                                                   |
| Amicizie      | ogni amicizia è un **gruppo nascosto `kind = 'direct'`** con 2 membri; il saldo con un amico è la somma su tutti i gruppi condivisi              |
| Ospiti        | `group_members.user_id` può essere NULL (ospite con `guest_name`). Le spese referenziano **membri**: rivendicare un ospite = impostare `user_id` |
| Quote salvate | payer e quote già calcolati, più l'input originale (`split_input` JSON) per rimodificare la spesa                                                |
| Ricorrenti    | job in-process (`setInterval` avviato in `hooks.server.ts` `init`), idempotente grazie a `next_run_on`                                           |
| Script        | `tsx` con import relativi (niente alias `$lib`)                                                                                                  |
| Debiti        | sempre semplificati (opzione per gruppo rimossa per semplicità)                                                                                  |
| 3D            | Threlte caricato in lazy (import dinamico + IntersectionObserver); loader di navigazione in CSS 3D                                               |

## Schema del database

```
users(id, name, email UQ, password_hash, avatar_path?, avatar_color, notify_prefs JSON,
      reduce_motion, onboarded_at?, created_at, deleted_at?)
sessions(id = sha256(token), user_id → users, expires_at, created_at)
password_reset_tokens(id = sha256(token), user_id, expires_at, used_at?)

groups(id, kind: group|direct, name, emoji, type: home|trip|couple|other,
       budget_cents?, budget_alert_sent_at?, archived_at?, created_by, created_at)
group_members(id, group_id, user_id?, guest_name?, role: admin|member, joined_at, left_at?)
       UQ(group_id, user_id)
friendships(user_a_id, user_b_id, group_id → groups(direct)) PK(user_a_id, user_b_id), a < b
invites(id, group_id, token UQ, created_by, guest_member_id?, expires_at, revoked_at?, created_at)

expenses(id, group_id, description, category, date, amount_cents, split_mode, split_input JSON,
         notes?, receipt_path?, recurring_id?, created_by, created_at, updated_at, deleted_at?, deleted_by?)
expense_payers(expense_id, member_id, amount_cents)  PK(expense_id, member_id)
expense_shares(expense_id, member_id, amount_cents)  PK(expense_id, member_id)
expense_comments(id, expense_id, user_id, body, created_at)

settlements(id, group_id, from_member_id, to_member_id, amount_cents,
            method: cash|bank|paypal|satispay|other, date, note?, created_by, created_at, deleted_at?)

recurring_expenses(id, group_id, frequency: weekly|monthly|yearly, next_run_on, template JSON,
                   active, created_by, created_at, last_run_at?)
activities(id, group_id, actor_user_id?, type, entity_id?, data JSON, created_at)
payment_reminders(id, group_id, from_user_id, to_member_id, created_at)  -- limite 24h
push_subscriptions(id, user_id, endpoint UQ, p256dh, auth, user_agent?, created_at)
```

Le voci di scontrino (modalità 6) vivono in `split_input`; le quote finali sono materializzate in
`expense_shares`, l'unica fonte per i saldi.

## Stato delle fasi

1. ✅ Setup, Tailwind, Drizzle + SQLite, schema, migrazioni, seed
2. ✅ Autenticazione (sessioni nel DB, argon2, rate limit, reset password, profilo)
3. ✅ Gruppi, membri, ospiti, inviti con link e QR code, amici
4. ✅ Spese (6 modalità, più pagatori), saldi, semplificazione, rimborsi, feed attività, commenti, cestino
5. ✅ Ricorrenti, statistiche, budget, ricerca/filtri, CSV, riepilogo condivisibile, promemoria
6. ✅ Home pubblica con esempio interattivo
7. ✅ Moneta 3D, portafoglio, pioggia di monete, tilt, flip, contatori, View Transitions
8. ✅ PWA: manifest, icone, InstallButton, service worker con gestione aggiornamenti, push
9. ✅ Backup e restore con rotazione
10. ✅ Test E2E, accessibilità (axe), README
