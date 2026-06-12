# Send a Letter — How It Works

> **Status: fully implemented and verified end-to-end against a live Supabase project.** All 7 build phases are complete, the 4 Drizzle migrations have been applied to a live database, and the whole flow (signup → onboarding → create → unlock → keep → received mail) has been walked through successfully. Deployment is configured (`vercel.json` cron for the expiry job) but the app is not asserted to be running in production here.

A full-stack Next.js (App Router) + Supabase app for sending **virtual letters**. A signed-in sender writes a letter (text + images), locks it behind a personal security question, and shares a human-readable URL. Anyone with the link can try to unlock it — but **a letter can be opened only once**. After the first correct answer it belongs to the opener (if they log in within 24h) or it expires. The sender keeps no copy and gets no record: every letter is **fire-and-forget and burns on open**.

URL scheme: `site.com/{sender-handle}/{receiver-name}/{letter-name}` — all three segments slugified, unique as a triple (`letters_url_unique`).

**Stack:** Next.js (App Router, TypeScript) · Tailwind + shadcn/ui · Supabase (email+password auth, Postgres + RLS, private Storage) · Drizzle ORM (server-side/service-role writes + migrations).

---

## The core idea

The whole app is built around one tension: **a link anyone can hold, content only one person can ever take.** Three mechanics make that work — a guessable-but-not-brute-forceable lock, an atomic single-open claim, and a 24h grace window that you either convert to ownership or lose. Below is how each is actually implemented.

---

### 1. The question / lock mechanic (`new/actions.ts`, `verify/route.ts`, `AnswerInput.tsx`)

When a sender composes a letter, they write a free-text **question + answer**. The raw answer is **never stored or sent to any client**. Instead `createLetterAction` ([new/actions.ts:135](src/app/new/actions.ts#L135)) derives two fields:

- **`answer_normalized`** = `answer.trim().toLowerCase()` — the only thing guesses are ever compared against. Outer whitespace trimmed, inner spaces and punctuation preserved, case-insensitive.
- **`answer_shape`** = `answer.trim().replace(/[^ ]/g, "_")` — every non-space char becomes `_`, spaces kept. `"San Diego"` → `"___ _____"`. This is the *only* leak about the answer: it encodes **character count and word breaks**, nothing else.

The locked page ([\[letter\]/page.tsx:166](src/app/[handle]/[receiver]/[letter]/page.tsx#L166)) is server-rendered and ships the visitor **only** `question` + `answer_shape` — plus the already-public `sender_handle` and `receiver_name` (both visible in the URL) used to render a personal greeting (*"Maya, you have a letter. from @handle"*). The question is framed as *"something only the two of you know"* rather than a clinical security gate. `AnswerInput.tsx` turns the shape into a row of underline slots (one `<span>` per `_`, blank gaps for spaces) sitting under a single real `<input>`. The opener types a guess and POSTs it to `/api/letters/[id]/verify`.

The verify route compares `guess.trim().toLowerCase() === answer_normalized`. **A wrong guess reveals nothing** — just `{ status: "incorrect" }`, no "you're close", no per-character feedback.

Because the lock is intentionally guessable, two rate limits stop brute force ([verify/route.ts](src/app/api/letters/[id]/verify/route.ts)):

- A **fast in-memory** per-`(letterId, IP)` fixed-window cap — **10 attempts / 5 min** ([verify/route.ts:18](src/app/api/letters/[id]/verify/route.ts#L18)). Best-effort, per server instance, not authoritative (it doesn't survive across Vercel lambdas).
- The **authoritative durable** per-letter cap — **20 attempts / 10 min** ([verify/route.ts:64](src/app/api/letters/[id]/verify/route.ts#L64)), counted in the `letter_verify_attempts` table via service-role Drizzle. This holds even if an attacker spoofs `X-Forwarded-For` or spreads across instances. Each attempt is recorded *before* the answer check; old rows are pruned on each call (and again by cron).

---

### 2. The atomic claim / open-once flow (`verify/route.ts:191`)

The first correct answer fires a **single conditional UPDATE** — the heart of "open-once, no races" ([verify/route.ts:191](src/app/api/letters/[id]/verify/route.ts#L191)):

```sql
UPDATE letters
SET opened_at = now(), claim_token = <new uuid>, expires_at = now() + 24h, status = 'opened'
WHERE id = ? AND opened_at IS NULL
RETURNING id, claim_token
```

The `opened_at IS NULL` guard means **exactly one caller gets a row back** — that caller is *the* opener. A simultaneous second correct guess finds `opened_at` already set, gets zero rows, and is shown *"someone's already opened this one."* No application-level locking needed; Postgres serializes it.

The opener's browser receives an **`httpOnly`, `Secure`, `SameSite=Lax` cookie** named `claim:{letterId}` holding the fresh `claim_token`, with `maxAge = 24h`. Being httpOnly, page JS can't read it (XSS-resistant); it's pure proof-of-claim. The route returns only `{ status: "unlocked" }` — **no body** — and the client reloads so the cookie-gated server render delivers the content.

---

### 3. The 24h grace window — keep it or lose it (`[letter]/page.tsx`, `save/route.ts`, `cron/expire`)

Once opened, the letter is in **grace**. Re-reading it is gated entirely on the cookie ([\[letter\]/page.tsx:93](src/app/[handle]/[receiver]/[letter]/page.tsx#L93)): the server loads the row, and only renders `body` + signed image URLs when `cookie.claim:{id} === row.claim_token` **and** the window is still open. Anyone else — even with the correct answer, even the original sender — gets the sealed *"already been opened"* view. The content fields are pulled into the render tree in **that one validated branch only**. Lose the cookie (incognito, cleared cookies, different device) before saving and you lose access; the escape hatch is to **log in immediately**.

Images live in a **private Supabase bucket**, pathed under `{letterId}/`. They're never served directly — on a valid grace (or saved) read the server mints **1-hour signed URLs** with the service-role admin client ([page.tsx:40](src/app/[handle]/[receiver]/[letter]/page.tsx#L40)).

**Keeping it forever:** in the grace view, a logged-in opener clicks "Keep this letter" → POST `/api/letters/[id]/save`. That route enforces everything in **one atomic UPDATE** ([save/route.ts:62](src/app/api/letters/[id]/save/route.ts#L62)) — auth user + profile, matching `claim_token` cookie, `status='opened'`, `expires_at > now()`, `saved_by IS NULL` — setting `saved_by = user.id`, `saved_at`, `status='saved'`. No row back ⇒ generic `cannot_save` (reveals nothing). The letter becomes theirs — **no copy is made**, the row simply changes owner — and now surfaces in **Received mail** (`/dashboard/received/[id]`), readable indefinitely and exempt from expiry. A logged-out opener instead sees a "log in to keep it" link to `/login?next=<this letter>` (the `next` is validated as a safe local path); a logged-in opener without a profile is routed to `/onboarding` first.

**Otherwise it expires.** A Vercel cron (`vercel.json`, **daily at midnight** — `0 0 * * *`) hits `/api/cron/expire` (bearer-token auth, length-safe compared, deny-by-default if `CRON_SECRET` is unset) and flips `opened` + `saved_by IS NULL` + past-due rows to `status='expired'`, and prunes stale `letter_verify_attempts` rows. This is **housekeeping only** — read-time guards in both the page and verify route already treat any `opened / saved_by NULL / expires_at <= now()` letter as expired ([page.tsx:76](src/app/[handle]/[receiver]/[letter]/page.tsx#L76)), so an un-flipped-but-past-due letter still reads as expired. Data is retained but inaccessible to everyone.

---

## Lifecycle states

| State | Meaning | Who can read content |
|-------|---------|----------------------|
| **unopened** | never solved | nobody (locked page shows only question + shape) |
| **opened** (grace) | solved once, ≤24h ago | only the cookie holder |
| **saved** | opener logged in during grace | `saved_by` user, forever, via Received mail |
| **expired** | 24h passed, never saved | nobody |

> Edge case handled deliberately: a `saved` row whose `saved_by` is `NULL` (the receiver's profile was deleted — `saved_by` is `ON DELETE SET NULL`) is treated as orphaned and inaccessible, never as readable.

---

## Auth, onboarding & handles

- **Auth** is Supabase **email + password** (`/signup`, `/login`). Sign-up may require email confirmation; `/auth/confirm` verifies the OTP token and the flow degrades gracefully if confirmation is disabled. All authorization decisions use `supabase.auth.getUser()` (server-validated), never the unverified `getSession()`.
- **Onboarding** (`/onboarding`): on first sign-in the user picks a **stable handle** that lives in every letter URL and can't be changed. The handle is slugified and validated, the unique-violation (`profiles_handle_unique`, Postgres `23505`) is caught as "handle taken," and a **reserved-handle blocklist** ([reserved-handles.ts](src/lib/reserved-handles.ts) — `login`, `dashboard`, `api`, `auth`, `new`, …) prevents a handle from shadowing a real route (handles occupy the first URL segment).
- **Redirect safety:** every post-auth `next` redirect passes through a single hardened guard ([safe-path.ts](src/lib/safe-path.ts)) that only accepts true local paths — rejecting `//host`, `/\host`, any backslash, `://`, and control characters — so the login round-trip can't be turned into an open redirect.
- The **sender keeps nothing**: there's deliberately no `letter_events` table and no "sent" list. The dashboard has only **Send mail** (compose) and **Received mail** (letters this user has saved).

---

## Data model (`src/db/schema/`)

| Table | Key columns | Notes |
|-------|-------------|-------|
| **profiles** | `id` (= `auth.users.id`), `handle` (unique), `display_name` | one row per user; `id` FK → `auth.users` `ON DELETE CASCADE` |
| **letters** | `sender_id`, `sender_handle`, `receiver_name`, `letter_name`, `body`, `question`, `answer_normalized`, `answer_shape`, `opened_at`, `claim_token`, `expires_at`, `saved_by`, `saved_at`, `status` | `status` enum `unopened\|opened\|saved\|expired`; unique triple `letters_url_unique (sender_handle, receiver_name, letter_name)`; index on `saved_by` |
| **letter_images** | `letter_id`, `storage_path`, `position` | `letter_id` FK → letters `ON DELETE CASCADE` |
| **letter_verify_attempts** | `letter_id`, `created_at` | ephemeral; powers the durable per-letter rate limit; pruned by cron |

**Migrations** (Drizzle, journal-tracked in `drizzle/`, applied via `npm run db:migrate` or the Supabase SQL editor — see `drizzle/README.md`):
- `0000` — tables, enum, unique constraint, indexes.
- `0001` — `profiles.id → auth.users` FK, **RLS enabled** on all app tables, the RLS policies, and the private `letters` storage bucket (`public = false`). Hand-authored as a journal-registered *custom* migration because it references the Supabase-managed `auth`/`storage` schemas.
- `0002`/`0003` — `letter_verify_attempts` table + its RLS (default-deny).

> Storage note: **no `storage.objects` RLS policies** are created. The bucket is private and accessed exclusively server-side via the secret key (which bypasses RLS); reads are always time-limited signed URLs. This sidesteps the "must be owner" failure when a migration tries to alter `storage.objects` on hosted Supabase.

---

## Security architecture: the data-access split

The strict rule: **`body`, `answer_normalized`, and `claim_token` never reach an unauthenticated client.** Enforced by splitting two data paths:

- **Drizzle (direct Postgres, secret key, bypasses RLS)** — schema, migrations, and all sensitive server-only logic: the locked-page read, verify, atomic claim, save, and the Received-mail content fetch. Each query **selects only the columns it needs** for the decision at hand (e.g. verify never selects `body`; the received page authorizes on `saved_by` first, then a *second* query pulls `body`).
- **Supabase JS client (RLS-enforced)** — auth and RLS-protected client reads. Senders can `INSERT` letters scoped to themselves but **never read them back** (no sent-history); saved letters are readable only by `saved_by = auth.uid()`. `letter_images` and `letter_verify_attempts` have RLS on with **no client policy** (default-deny).

**API keys:** the app uses the **new Supabase API keys** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`, browser/SSR clients) and `SUPABASE_SECRET_KEY` (`sb_secret_…`, server-only admin client) — replacing the deprecated `anon` / `service_role` keys. The secret key is `server-only`-guarded ([admin.ts](src/lib/supabase/admin.ts)) so it can never reach the browser bundle.

Other hardening worth noting:
- **Image uploads** are validated by **magic bytes** ([new/actions.ts:17](src/app/new/actions.ts#L17)), not the client-supplied `file.type` — only PNG/JPEG/GIF/WEBP pass; SVG is rejected. Filenames are sanitized (no path separators, leading dots, or control bytes). Validation happens *before* any DB insert; image-phase failures roll back the letter row + uploaded objects (no orphans).
- A **slug collision** on create is caught via the postgres.js `constraint_name` and returned as "that letter name is taken" — the action **returns** rather than throws, so the sender's draft survives in the mounted form.
- Letter **body is rendered as escaped plain text** with `whitespace-pre-wrap` (never `dangerouslySetInnerHTML`).
- Sign-up errors are **neutralized against email enumeration** (an already-registered address follows the same "check your email" path as a fresh sign-up); sign-out uses a 303 redirect so the POST lands on `/` as a GET.

---

## Route map

| Route | Purpose |
|-------|---------|
| `/` | landing |
| `/signup`, `/login`, `/auth/confirm`, `/auth/signout` | email + password auth (`?next=` preserved + validated through login) |
| `/onboarding` | pick stable handle on first sign-in |
| `/dashboard` | Send mail (compose) + Received mail (saved letters) |
| `/new` → `/new/created` | create-letter form + share-link confirmation (the one chance to copy the URL) |
| `/{handle}/{receiver}/{letter}` | the envelope page: locked / unsealed-grace / sealed / expired |
| `POST /api/letters/[id]/verify` | rate-limited answer check + atomic claim + sets claim cookie |
| `POST /api/letters/[id]/save` | atomic keep within grace (auth + cookie + window) |
| `GET/POST /api/cron/expire` | scheduled expiry flip + rate-limit pruning (bearer-auth) |
| `/dashboard/received/[id]` | permanent, ownership-checked view of a saved letter |
