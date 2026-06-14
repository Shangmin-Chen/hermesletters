# Architecture

How Send a Letter works, end to end. For the threat model and the data-access
rules, see [SECURITY.md](./SECURITY.md). For the writing/reading experience, see
[PRODUCT.md](./PRODUCT.md). To run it locally, see
[DEVELOPMENT.md](./DEVELOPMENT.md).

## The core idea

The whole app is built around one tension: **a link anyone can hold, content
only one person can ever take.** Three mechanics make that work:

1. a **guessable-but-not-brute-forceable lock**,
2. an **atomic single-open claim**, and
3. a **24-hour grace window** you either convert to ownership or lose.

A signed-in sender writes a letter (text + optional images), locks it behind a
personal question, and shares a human-readable URL. Anyone with the link can try
to unlock it — but a letter **opens only once**. After the first correct answer
it belongs to the opener (if they sign in within 24h) or it expires. The sender
keeps no copy and gets no record: every letter is **fire-and-forget and burns on
open**.

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
site.com/{sender-handle}/{receiver-name}/{letter-name}
```

All three segments are slugified; the triple is unique
(`letters_url_unique`). A collision on create is rejected with "that letter name
is taken" — no silent suffixing. The handle is the first segment, so a
[reserved-handle blocklist](../src/lib/reserved-handles.ts) prevents handles from
shadowing real routes (`login`, `dashboard`, `api`, `new`, …).

---

## The three mechanics

### 1. The lock — question + answer

When a sender composes a letter they write a free-text **question + answer**. The
raw answer is **never stored or sent to any client**. `createLetterAction`
([`src/app/new/actions.ts`](../src/app/new/actions.ts)) derives two fields
instead:

- **`answer_normalized`** = `answer.trim().toLowerCase()` — the only value a
  guess is ever compared against (outer whitespace trimmed, inner spaces and
  punctuation preserved, case-insensitive).
- **`answer_shape`** = `answer.trim().replace(/[^ ]/g, "_")` — every non-space
  char becomes `_`, spaces kept. `"San Diego"` → `"___ _____"`. This is the
  *only* leak about the answer: character count and word breaks, nothing else.

The locked page ships the visitor **only** `question` + `answer_shape` (plus the
already-public handle and receiver name from the URL, used for the greeting).
[`AnswerInput.tsx`](../src/app/[handle]/[receiver]/[letter]/AnswerInput.tsx)
renders the shape as decorative underline slots under a single real input and
POSTs the guess to `/api/letters/[id]/verify`. A **wrong guess reveals nothing**
— just `{ status: "incorrect" }`, no "you're close", no per-character feedback.

Because the lock is intentionally guessable, two rate limits stop brute force
([`verify/route.ts`](../src/app/api/letters/[id]/verify/route.ts)):

- a **fast in-memory** cap, **10 attempts / 5 min** per `(letterId, IP)` —
  best-effort, per server instance;
- the **authoritative durable** cap, **20 attempts / 10 min** per letter, counted
  in the `letter_verify_attempts` table (service-role Drizzle), which holds even
  against spoofed `X-Forwarded-For` or spread across instances. Old rows are
  pruned on each call and by cron.

### 2. The atomic claim — open once, no races

The first correct answer fires a **single conditional UPDATE** — the heart of
"open-once":

```sql
UPDATE letters
SET opened_at = now(), claim_token = <new uuid>, expires_at = now() + 24h, status = 'opened'
WHERE id = ? AND opened_at IS NULL
RETURNING id, claim_token
```

The `opened_at IS NULL` guard means **exactly one caller gets a row back** —
that caller is *the* opener. A simultaneous second correct guess finds
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
row.claim_token` **and** the window is still open. Anyone else — even with the
correct answer, even the original sender — gets the sealed *"already opened"*
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
and flips past-due `opened` + `saved_by IS NULL` rows to `expired`, pruning stale
verify-attempt rows. This is **housekeeping only** — read-time guards in the page
and verify route already treat any `opened / saved_by NULL / expires_at <= now()`
letter as expired, so an un-flipped-but-past-due letter still reads as expired.

---

## Lifecycle states

| State | Meaning | Who can read content |
|---|---|---|
| **unopened** | never solved | nobody (locked page shows only question + shape) |
| **opened** (grace) | solved once, ≤24h ago | only the cookie holder |
| **saved** | opener signed in during grace | `saved_by` user, forever, via Received mail |
| **expired** | 24h passed, never saved | nobody |

> Deliberate edge case: a `saved` row whose `saved_by` is `NULL` (the receiver's
> profile was deleted — `saved_by` is `ON DELETE SET NULL`) is treated as
> orphaned and inaccessible, never as readable.

---

## Auth, onboarding & handles

- **Auth** is Supabase email + password (`/signup`, `/login`). Sign-up may
  require email confirmation; `/auth/confirm` verifies the OTP and degrades
  gracefully if confirmation is disabled. Every authorization decision uses
  `supabase.auth.getUser()` (server-validated), never the unverified
  `getSession()`.
- **Onboarding** (`/onboarding`): on first sign-in the user picks a **stable
  handle** that lives in every letter URL and can't be changed. It's slugified,
  validated against the reserved blocklist, and the unique-violation
  (`profiles_handle_unique`) is caught as "handle taken."
- **The sender keeps nothing:** there's deliberately no `letter_events` table and
  no "sent" list. The dashboard has only **Send mail** (compose) and **Received
  mail** (saved letters).

---

## Data model

Schema lives in [`src/db/schema/`](../src/db/schema/).

| Table | Key columns | Notes |
|---|---|---|
| **profiles** | `id` (= `auth.users.id`), `handle` (unique), `display_name` | one row per user; `id` FK → `auth.users` `ON DELETE CASCADE` |
| **letters** | `sender_id`, `sender_handle`, `receiver_name`, `letter_name`, `body`, `question`, `answer_normalized`, `answer_shape`, `opened_at`, `claim_token`, `expires_at`, `saved_by`, `saved_at`, `status` | `status` enum `unopened\|opened\|saved\|expired`; unique triple `letters_url_unique`; index on `saved_by` |
| **letter_images** | `letter_id`, `storage_path`, `position` | `letter_id` FK → letters `ON DELETE CASCADE` |
| **letter_verify_attempts** | `letter_id`, `created_at` | ephemeral; powers the durable rate limit; pruned by cron |

**Migrations** (Drizzle, journal-tracked in [`drizzle/`](../drizzle/)):

- `0000` — tables, enum, unique constraint, indexes.
- `0001` — `profiles.id → auth.users` FK, **RLS enabled** on all app tables, the
  RLS policies, and the private `letters` storage bucket. Hand-authored as a
  registered *custom* migration because it references Supabase-managed
  `auth`/`storage` schemas.
- `0002` / `0003` — `letter_verify_attempts` table + its default-deny RLS.

> The storage bucket is private with **no `storage.objects` RLS policies**: it's
> accessed exclusively server-side via the secret key (which bypasses RLS) and
> reads are always time-limited signed URLs. This avoids the "must be owner"
> failure when altering `storage.objects` on hosted Supabase.

---

## Route map

| Route | Purpose |
|---|---|
| `/` | landing |
| `/signup`, `/login`, `/auth/confirm`, `/auth/signout` | email + password auth (`?next=` preserved + validated through the whole chain) |
| `/onboarding` | pick a stable handle on first sign-in |
| `/dashboard` | Send mail (compose) + Received mail (saved letters) |
| `/new` → `/new/created` | the compose ritual + the share-link confirmation |
| `/{handle}/{receiver}/{letter}` | the letter page: locked / unsealed-grace / sealed / expired |
| `POST /api/letters/[id]/verify` | rate-limited answer check + atomic claim + claim cookie |
| `POST /api/letters/[id]/save` | atomic keep within grace (auth + cookie + window) |
| `GET/POST /api/cron/expire` | scheduled expiry flip + rate-limit pruning (bearer-auth) |
| `/dashboard/received/[id]` | permanent, ownership-checked view of a saved letter |
| `/dev/*` | **dev-only** QA harness (404s in production) — see [DEVELOPMENT.md](./DEVELOPMENT.md#qa-harness) |

## Project layout

```
src/
  app/
    new/                       the compose ritual (ComposeLetter + scenes + fold)
    [handle]/[receiver]/[letter]/
                               the letter page, its views, and AnswerInput
    api/letters/[id]/          verify + save route handlers
    api/cron/expire/           scheduled expiry job
    dashboard/ login/ signup/ onboarding/ auth/
    dev/                       dev-only QA harness
    globals.css                design tokens, theming, animation keyframes
  components/                  brand marks, shadcn ui primitives
  db/                          Drizzle client + schema
  lib/                         auth, slugify, safe-path, letter-validation, supabase clients
drizzle/                       generated SQL migrations
```
