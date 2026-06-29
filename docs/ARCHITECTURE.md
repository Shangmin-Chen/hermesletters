# Architecture

How Hermes Letters works, end to end. For the threat model and the data-access
rules, see [SECURITY.md](./SECURITY.md). For the writing/reading experience, see
[PRODUCT.md](./PRODUCT.md). To run it locally, see
[DEVELOPMENT.md](./DEVELOPMENT.md).

## The core idea

The whole app is built around one tension: **a link anyone can hold, content
only one person can ever take.** Three mechanics make that work:

1. a **wax-seal gesture that opens the letter once**,
2. an **atomic single-open claim**, and
3. a **24-hour grace window** you either convert to ownership or lose.

A signed-in sender writes a letter (text + optional images), seals it with an
intimate shared-secret prompt, and shares an opaque invite URL that carries a
random open token. The recipient needs both the sealed link and the answer, then
presses and holds the wax seal to unseal it — but a letter **opens only once**.
After the first successful unlock it belongs to the opener (if they sign in
within 24h) or it expires. The sender keeps no readable copy and gets no record:
every letter is **fire-and-forget and burns on open**.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| UI | React, Tailwind CSS v4, shadcn/ui, Web Animations API |
| Auth / DB / Storage | Supabase (email + password, Postgres + RLS, private Storage) |
| ORM / migrations | Drizzle + drizzle-kit (server-side queries, generated SQL) |
| SSR auth glue | `@supabase/ssr` |
| Hosting | Vercel (cron for the expiry job) |

## URL scheme

```
site.com/l/{public_id}?t={open-token}
```

New invite links are keyed by `letters.public_id`, an immutable opaque id with
the `ltr_` prefix. Invite links also carry an unguessable random open token in
the query string; only its hash is stored in the database.

Legacy invite links of the form
`site.com/{sender-handle}/{receiver-name}/{letter-name}?t={open-token}` still
render for already-shared links. All three legacy segments are slugified, but
they are no longer the canonical identity and are not globally unique. Because
the sender handle is the first legacy segment, a
[reserved-handle blocklist](../src/lib/reserved-handles.ts) prevents handles from
shadowing real routes (`login`, `dashboard`, `api`, `new`, …).

The v2 API surfaces use the same opaque identity. V2 still writes the same
`claim:{letter_uuid}` cookie as the legacy invite flow because the grace-window
page render and invite-only signup gate both consume that existing browser claim
namespace.

---

## The three mechanics

### 1. The lock — shared secret + wax-seal gesture

The locked page ships the visitor only the already-public handle and receiver
name from the URL (used for the greeting), plus the sender's private prompt. For
invite letters, access requires **both** the random open token from the URL and a
matching shared-secret answer. The answer itself is never stored; the database
keeps only a salted HMAC hash and a display-only answer shape. Direct letters
are addressed to an authenticated recipient and may optionally require the same
kind of prompt.

[`WaxUnseal.tsx`](../src/components/letter/WaxUnseal.tsx) renders a sealed
envelope with the wax seal as a press-and-hold target (750 ms hold, or keyboard
Enter/Space). A charging ring fills around the seal as the hold progresses; on
commit, the seal cracks and the flap swings open, then
[`LockedView`](../src/app/[handle]/[receiver]/[letter]/letter-views.tsx) POSTs
to `/api/letters/[id]/verify` with `{ token, guess }`. If the POST fails
(expired / already-opened / wrong answer / bad token / rate-limited / network
error), `WaxUnseal` is reset via a `resetKey` prop so the user can retry without
a full page reload.

Answer attempts are rate-limited durably through `letter_verify_attempts`; the
random open token prevents slug guessing from reaching the answer challenge in
the first place. The claim is still written under an atomic guard that makes
replay harmless.

### 2. The atomic claim — open once, no races

After the token and answer are accepted, the first unlock fires a **single
conditional UPDATE** — the heart of "open-once":

```sql
UPDATE letters
SET opened_at = now(), claim_token = <new uuid>, expires_at = now() + 24h, status = 'opened'
WHERE id = ? AND opened_at IS NULL
RETURNING id, claim_token
```

The `opened_at IS NULL` guard means **exactly one caller gets a row back** —
that caller is *the* opener. A simultaneous second unlock finds
`opened_at` already set, gets zero rows, and sees *"someone's already opened this
one."* Postgres serializes it; no application-level locking.

The opener's browser receives an **`httpOnly`, `Secure`, `SameSite=Lax` cookie**
named `claim:{letterId}` holding the fresh `claim_token` (`maxAge` 24h). Page JS
can't read it (XSS-resistant) — it's pure proof-of-claim. The verify route
returns only `{ status: "unlocked" }` (**no body**); the client refreshes so the
cookie-gated server render delivers the content.

### 3. The grace window — keep it or lose it

Once opened, the letter is in **grace**. Re-reading is gated entirely on the
cookie: the letter page
([`page.tsx`](../src/app/[handle]/[receiver]/[letter]/page.tsx)) loads the row and
renders `body` + signed image URLs **only** when `cookie.claim:{id} ===
row.claim_token` **and** the window is still open. Anyone else — even holding the
link, even the original sender — gets the sealed *"already opened"*
view. **The content fields enter the render tree in that one validated branch
only** (see [SECURITY.md](./SECURITY.md)). Lose the cookie before saving and you
lose access; the escape hatch is to **sign in immediately**.

Images live in a **private Supabase bucket** under `{letterId}/` and are never
served directly — a valid grace (or saved) read mints **1-hour signed URLs** via
the service-role admin client.

**Keeping it forever:** a signed-in opener clicks "Keep this letter" → POST
`/api/letters/[id]/save`, which enforces everything in **one atomic UPDATE**
(auth user + profile, matching cookie, `status='opened'`, `expires_at > now()`,
`saved_by IS NULL`) and sets `saved_by`, `saved_at`, `status='saved'`. No copy is
made — the row changes owner — and the letter surfaces in **Received mail**
(`/dashboard/received/[id]`), readable indefinitely, exempt from expiry. A
logged-out opener is offered "log in / sign up to keep it," with the letter path
carried through the whole auth round-trip as a validated `next` (see
[SECURITY.md](./SECURITY.md#redirect-safety)).

**Otherwise it expires.** A Vercel cron (daily at midnight, `0 0 * * *`) hits
`/api/cron/expire` (bearer-token auth, deny-by-default if `CRON_SECRET` is unset)
and flips past-due `opened` + `saved_by IS NULL` rows to `expired`. It also
prunes `letter_verify_attempts` rows older than 1 hour and returns only aggregate
counts. This is **housekeeping only** — read-time guards in the page, inbox, and
verify route already treat any `opened / saved_by NULL / expires_at <= now()`
letter as expired, so an un-flipped-but-past-due letter still reads as expired.

## Direct letters & the phonebook

The grace/claim machinery above is the **invite letter** — sent to someone who
isn't yet a user, via a link. A second kind exists: a **direct letter** sent
straight to an existing connection, identified by `letters.receiver_id` being set
(invite letters keep it `NULL`).

- **Connections (phonebook).** A read-model derived from `letters`, no edge table:
  two users are connected once they've exchanged a *kept* letter in either
  direction (`saved_by`/`sender_id`). [`src/lib/connections.ts`](../src/lib/connections.ts)
  exposes `getConnections`, `areConnected` (the send-authorization primitive), and
  `hasUnseenConnections` (the red dot). `/phonebook` lists them.
- **Sending.** From a phonebook row → `/new?to=<handle>`. `sendDirectLetterAction`
  re-resolves the handle and re-checks `areConnected` server-side (never trusting
  the client `to`), blocks self-sends, and inserts a letter with `receiver_id`
  set. The sender can choose whether this direct letter also asks a shared-secret
  prompt before opening.
- **Receiving.** Direct letters surface in the dashboard **You've got mail** inbox.
  Opening uses the same wax-unseal ceremony, but the open is an **authenticated
  server action** (`openDirectLetterAction`) gated by `receiver_id === session
  user` (and the optional shared-secret answer) in an atomic guarded UPDATE.
  Opening starts the same 24-hour grace window; the receiver must keep the letter
  or it expires. `/dashboard/inbox/[id]` renders the sealed gesture, opened-grace
  content with a keep action, or an expired view, reusing the same
  ownership-then-body discipline as Received mail.
- **New-connection red dot.** A `profiles.connections_seen_at` cursor: the dot
  shows on the dashboard Phonebook button when any connection edge's kept-letter
  `saved_at` is newer than the cursor; visiting `/phonebook` advances the cursor.

---

## Lifecycle states

| State | Meaning | Who can read content |
|---|---|---|
| **unopened** | never unsealed | nobody (locked page shows the wax-seal gesture) |
| **opened** (grace) | solved once, ≤24h ago | invite: only the cookie holder; direct: the addressed receiver |
| **saved** | opener signed in during grace | `saved_by` user, forever, via Received mail |
| **expired** | 24h passed, never saved | nobody |

> Deliberate edge case: a `saved` row whose `saved_by` is `NULL` (the receiver's
> profile was deleted — `saved_by` is `ON DELETE SET NULL`) is treated as
> orphaned and inaccessible, never as readable.
>
> **Direct letters** (`receiver_id` set) use the same `unopened → opened →
> saved/expired` lifecycle, but the opened-grace read is gated by
> `receiver_id = session user` rather than the invite claim cookie.

---

## Auth, onboarding & handles

- **Auth** is Supabase email + password (`/login`). Email confirmation is
  **disabled** — sign-up returns a live session immediately, and the
  `/auth/confirm` OTP route has been removed. Every authorization decision uses
  `supabase.auth.getUser()` (server-validated), never the unverified
  `getSession()`.
- **Signup is invite-only.** There is no public sign-up entry point (removed from
  the homepage, header, and login page). You can only create an account by
  **keeping a letter you received**: `/signup` is reached from the keep-flow and
  is gated server-side — the page shows a calm invite-only message unless `next`
  identifies a valid in-grace letter and the browser holds the matching
  `claim:{letterId}` cookie. No claim, no account. See
  [SECURITY.md](./SECURITY.md#invite-only-signup).
- **Onboarding** (`/onboarding`): on first sign-in the user picks a **stable
  handle** used for profile identity and legacy letter URLs. It can't be
  changed. It's slugified, validated against the reserved blocklist, and the unique-violation
  (`profiles_handle_unique`) is caught as "handle taken."
- **The sender keeps nothing:** there's deliberately no `letter_events` table and
  no "sent" list. The dashboard has **compose**, **You've got mail** (direct-letter
  inbox), and **Kept letters** (saved invite letters).

---

## Data model

Schema lives in [`src/db/schema/`](../src/db/schema/).

| Table | Key columns | Notes |
|---|---|---|
| **profiles** | `id` (= `auth.users.id`), `handle` (unique), `display_name`, `connections_seen_at` | one row per user; `id` FK → `auth.users` `ON DELETE CASCADE`; `connections_seen_at` is the new-connection red-dot cursor |
| **letters** | `id`, `public_id`, `sender_id`, `sender_handle`, `receiver_name`, `letter_name`, `receiver_id`, `body`, `open_token_hash`, `secret_prompt`, `secret_answer_hash`, `secret_answer_salt`, `secret_answer_shape`, `opened_at`, `claim_token`, `expires_at`, `saved_by`, `saved_at`, `status` | `status` enum `unopened\|opened\|saved\|expired`; unique opaque `public_id`; indexes on `saved_by`, `sender_id`, `(receiver_id, status)`, and the non-unique legacy URL triple. `receiver_id` (FK → profiles, cascade) set only for **direct letters** |
| **letter_images** | `letter_id`, `storage_path`, `position`, `caption` | `letter_id` FK → letters `ON DELETE CASCADE`; `caption` is an optional per-photo caption |
| **letter_verify_attempts** | `letter_id`, `actor_key`, `created_at` | durable rolling-window cap for shared-secret answer attempts; RLS-enabled with no client policies; `actor_key` is a server-keyed digest, not raw request or profile data |

**Migrations** (Drizzle, journal-tracked in [`drizzle/`](../drizzle/)):

- `0000` — tables, enum, unique constraint, indexes.
- `0001` — `profiles.id → auth.users` FK, **RLS enabled** on all app tables, the
  RLS policies, and the private `letters` storage bucket. Hand-authored as a
  registered *custom* migration because it references Supabase-managed
  `auth`/`storage` schemas.
- `0002`–`0003` — earlier letter-lifecycle + RLS adjustments.
- `0004` — removes the original security-question columns
  (`answer_normalized` / `answer_shape`) and **adds `letter_images.caption`**.
  *Destructive — apply deliberately.*
- `0005` — direct letters: `letters.receiver_id` (+ `(receiver_id, status)` index),
  `profiles.connections_seen_at`, and the original direct-recipient RLS policy
  later removed by `0009`.
- `0006` — `letters_sender_id_idx` (covers the phonebook sender-side queries).
- `0007` — tokenized invite links and shared-secret prompts: adds
  `open_token_hash`, `secret_prompt`, `secret_answer_hash`,
  `secret_answer_salt`, `secret_answer_shape`, and recreates
  `letter_verify_attempts` for durable answer-attempt limits.
- `0008` — saved-letter archive flag (`letters.archived_at`).
- `0009` — removes legacy public `letters` insert/select policies so full
  letter rows are server-mediated.
- `0010` — adds `letter_verify_attempts.actor_key` and an actor-window index for
  privacy-preserving per-actor answer-attempt limits.
- `0011` — adds the private `record_letter_verify_attempt` Postgres function,
  which records attempts under a transaction-scoped per-letter advisory lock.
- `0012` — revokes that function from Supabase `anon` and `authenticated` RPC
  roles.
- `0013` — adds `letters.public_id`, backfills existing rows from UUIDs, then
  enforces non-null + unique for v2 API lookup.
- `0014` — drops the legacy `(sender_handle, receiver_name, letter_name)`
  uniqueness constraint now that public invites are keyed by `public_id`.
- `0015` — adds a non-unique legacy URL triple index so compatibility lookups
  remain indexed after `0014`.

> The storage bucket is private with **no `storage.objects` RLS policies**: it's
> accessed exclusively server-side via the secret key (which bypasses RLS) and
> reads are always time-limited signed URLs. This avoids the "must be owner"
> failure when altering `storage.objects` on hosted Supabase.

---

## Route map

| Route | Purpose |
|---|---|
| `/` | landing; shows a global "Hermes has delivered X letters" count (delivered = opened). Invite-only: a "Sign in" link only, no public sign-up |
| `/login`, `/auth/signout` | email + password auth (`?next=` preserved + validated through the whole chain); email confirmation disabled, `/auth/confirm` removed |
| `/signup` | **invite-only**: valid `next` + claim cookie shows contextual signup for keeping that letter; missing/invalid proof shows the invite-only refusal |
| `/onboarding` | pick a stable handle on first sign-in |
| `/dashboard` | compose + You've got mail (direct-letter inbox) + Kept letters; Phonebook button with the new-connection red dot |
| `/phonebook` | connections (read-model); each row links to `/new?to=<handle>` |
| `/new` → `/new/created` | the compose ritual + tokenized share-link confirmation (invite) |
| `/new?to=<handle>` → `/new/sent` | direct-letter compose (locked recipient, optional shared secret) + a "sent" confirmation |
| `/l/[publicId]` | the canonical invite letter page: locked / unsealed-grace / sealed / expired |
| `/{handle}/{receiver}/{letter}` | legacy invite letter page compatibility path |
| `/dashboard/received/[id]` | permanent, ownership-checked view of any saved letter |
| `/dashboard/inbox/[id]` | a direct letter: sealed wax-unseal, opened grace, or expired, gated by `receiver_id` |
| `POST /api/letters/[id]/verify` | token + shared-secret check, atomic claim, claim cookie (invite open) |
| `POST /api/letters/[id]/save` | atomic keep within grace (invite: auth + cookie + window; direct: addressed receiver + window) |
| `GET/POST /api/cron/expire` | scheduled expiry flip + stale verify-attempt prune (bearer-auth) |
| `POST /api/v2/letters/[publicId]/open-claims` | v2 invite open by opaque `public_id`, with structured `{ data }` / `{ error }` envelopes |
| `POST /api/v2/letters/[publicId]/saves` | v2 keep by opaque `public_id`, preserving the same claim/identity/window guards |
| `GET /api/v2/handles/check` | versioned alias for handle availability |
| `GET/POST /api/v2/cron/expire` | versioned alias for the expiry job |
| `/dev/*` | **dev-only** QA harness (404s in production) — see [DEVELOPMENT.md](./DEVELOPMENT.md#qa-harness) |

> Direct-letter opening is a server action (`openDirectLetterAction`), not a route;
> `sendDirectLetterAction` and `dismissConnectionsBadge` are likewise server actions.

### API versioning (v1 → v2)

The original `/api/letters/[id]/*` routes are **v1** and stay in place for the
app's own UI and any already-shared links. **v2** (`/api/v2/*`) is the cleaner
public surface and the one to build against going forward:

- **Opaque identity.** v2 addresses letters by the immutable `public_id`
  (`ltr_…`), never by raw UUID or the slug triple — so links don't leak
  enumerable database ids and can't collide when names slugify the same.
- **Structured envelopes.** Every response is `{ data }` on success or
  `{ error: { code, message } }` on failure, with REST-aligned status codes
  (`201` claimed/saved, `404/409/410/422/429` mapped from the service result) —
  versus v1's flat `{ status }` strings.
- **One implementation, two skins.** Both versions are thin route handlers over
  the same server-only service layer (`server/letters/`): `claimInviteLetter`
  and `saveLetterForProfile` own the atomic claim, shared-secret check, rate
  limit, ownership gate, and grace window. A `LetterLookup` discriminated union
  lets a route resolve by `id` (v1) or `public_id` (v2) against identical guards,
  so the two surfaces can never drift in their security behavior.
- **Shared claim cookie.** v2 deliberately still writes the v1
  `claim:{letter_uuid}` cookie (keyed by internal id, not `public_id`) because
  the grace-window page render and the invite-only signup gate read that same
  browser namespace — see [SECURITY.md](./SECURITY.md#api-versioning-v2).

`handles/check` and `cron/expire` are exposed under v2 as straight re-exports of
their v1 handlers — versioned aliases with no behavioral change.

## Project layout

```
src/
  app/
    (chrome)/new/              the compose flow and confirmation pages
    l/[publicId]/              canonical public invite page
    [handle]/[receiver]/[letter]/
                               legacy public invite page compatibility path
    letter-page-shared.tsx     shared invite-page renderer for public_id and legacy lookups
    api/letters/[id]/          legacy (v1) verify + save route handlers
    api/v2/                    versioned API: letters/[publicId]/{open-claims,saves}, handles/check, cron/expire
    api/cron/expire/           scheduled expiry job
    dashboard/                 compose entry + inbox + kept letters
    dashboard/inbox/[id]/      direct-letter view (+ openDirectLetterAction)
    phonebook/                 connections list (+ dismissConnectionsBadge)
    login/ signup/ onboarding/ auth/
    dev/                       dev-only QA harness
    globals.css                design tokens, theming, animation keyframes
  components/                  brand marks, shadcn ui primitives, letter/ (WaxUnseal, PhotoGallery, …)
  db/                          Drizzle client + schema
  server/letters/             shared open/save service layer behind v1 + v2 routes
                               (claim-invite-letter, save-letter, letter-lookup, claim-cookie)
  lib/                         auth, connections, slugify, safe-path, zip-filter, letter-validation, letter-public-id, supabase clients
drizzle/                       generated SQL migrations
```
