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
intimate shared-secret prompt, and shares a human-readable URL that carries a
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
site.com/{sender-handle}/{receiver-name}/{letter-name}?t={open-token}
```

All three segments are slugified; the triple is unique
(`letters_url_unique`). A collision on create is rejected with "that letter name
is taken" — no silent suffixing. Invite links also carry an unguessable random
open token in the query string; only its hash is stored in the database. The
handle is the first segment, so a
[reserved-handle blocklist](../src/lib/reserved-handles.ts) prevents handles from
shadowing real routes (`login`, `dashboard`, `api`, `new`, …).

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
and flips past-due `opened` + `saved_by IS NULL` rows to `expired`. This is
**housekeeping only** — read-time guards in the page, inbox, and verify route
already treat any `opened / saved_by NULL / expires_at <= now()` letter as
expired, so an un-flipped-but-past-due letter still reads as expired.

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
  handle** that lives in every letter URL and can't be changed. It's slugified,
  validated against the reserved blocklist, and the unique-violation
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
| **letters** | `sender_id`, `sender_handle`, `receiver_name`, `letter_name`, `receiver_id`, `body`, `open_token_hash`, `secret_prompt`, `secret_answer_hash`, `secret_answer_salt`, `secret_answer_shape`, `opened_at`, `claim_token`, `expires_at`, `saved_by`, `saved_at`, `status` | `status` enum `unopened\|opened\|saved\|expired`; unique triple `letters_url_unique`; indexes on `saved_by`, `sender_id`, `(receiver_id, status)`. `receiver_id` (FK → profiles, cascade) set only for **direct letters** |
| **letter_images** | `letter_id`, `storage_path`, `position`, `caption` | `letter_id` FK → letters `ON DELETE CASCADE`; `caption` is an optional per-photo caption |
| **letter_verify_attempts** | `letter_id`, `created_at` | durable rolling-window cap for shared-secret answer attempts; RLS-enabled with no client policies |

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
  `profiles.connections_seen_at`, and a hand-appended `letters: select received by
  me` RLS policy (`receiver_id = auth.uid()`).
- `0006` — `letters_sender_id_idx` (covers the phonebook sender-side queries).
- `0007` — tokenized invite links and shared-secret prompts: adds
  `open_token_hash`, `secret_prompt`, `secret_answer_hash`,
  `secret_answer_salt`, `secret_answer_shape`, and recreates
  `letter_verify_attempts` for durable answer-attempt limits.

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
| `/{handle}/{receiver}/{letter}` | the invite letter page: locked / unsealed-grace / sealed / expired |
| `/dashboard/received/[id]` | permanent, ownership-checked view of any saved letter |
| `/dashboard/inbox/[id]` | a direct letter: sealed wax-unseal, opened grace, or expired, gated by `receiver_id` |
| `POST /api/letters/[id]/verify` | token + shared-secret check, atomic claim, claim cookie (invite open) |
| `POST /api/letters/[id]/save` | atomic keep within grace (invite: auth + cookie + window; direct: addressed receiver + window) |
| `GET/POST /api/cron/expire` | scheduled expiry flip (bearer-auth) |
| `/dev/*` | **dev-only** QA harness (404s in production) — see [DEVELOPMENT.md](./DEVELOPMENT.md#qa-harness) |

> Direct-letter opening is a server action (`openDirectLetterAction`), not a route;
> `sendDirectLetterAction` and `dismissConnectionsBadge` are likewise server actions.

## Project layout

```
src/
  app/
    (chrome)/new/              the compose flow and confirmation pages
    [handle]/[receiver]/[letter]/
                               the letter page and its views (LockedView owns the unlock POST)
    api/letters/[id]/          verify + save route handlers
    api/cron/expire/           scheduled expiry job
    dashboard/                 compose entry + inbox + kept letters
    dashboard/inbox/[id]/      direct-letter view (+ openDirectLetterAction)
    phonebook/                 connections list (+ dismissConnectionsBadge)
    login/ signup/ onboarding/ auth/
    dev/                       dev-only QA harness
    globals.css                design tokens, theming, animation keyframes
  components/                  brand marks, shadcn ui primitives, letter/ (WaxUnseal, PhotoGallery, …)
  db/                          Drizzle client + schema
  lib/                         auth, connections, slugify, safe-path, zip-filter, letter-validation, supabase clients
drizzle/                       generated SQL migrations
```
