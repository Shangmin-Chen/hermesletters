# Security model

Hermes Letters' entire value proposition is access control: *a link anyone can
hold, content only one person can ever take.* This document is the authoritative
reference for how that's enforced. For the mechanics it protects (lock, claim,
grace), see [ARCHITECTURE.md](./ARCHITECTURE.md).

## The core invariant

> **`body`, `claim_token`, `open_token_hash`, and shared-secret answer hashes
> never reach an unauthenticated client.**

Everything below exists to uphold that one sentence.

## The data-access split

Two data paths, deliberately separated:

- **Drizzle (direct Postgres, secret key, bypasses RLS)** — schema, migrations,
  and all sensitive server-only logic: the locked-page read, verify, atomic
  claim, save, direct-letter open, and the Received-mail content fetch. Each
  query **selects only the columns it needs** for the decision at hand (verify
  never selects `body`; the Received page authorizes on `saved_by` first, then a
  *second* query pulls `body`).
- **Supabase JS client (RLS-enforced)** — auth and RLS-protected client reads.
  Senders can `INSERT` letters scoped to themselves but **never read them back**
  (no sent-history). Saved letters are readable only by `saved_by = auth.uid()`.
  `letter_images` has RLS on with **no client policy** (default-deny).

## The single validated branch

For invite links, `body` and signed image URLs enter the React render tree in
exactly **one** place: the cookie-validated grace branch of
[`page.tsx`](../src/app/[handle]/[receiver]/[letter]/page.tsx), where
`cookie.claim:{id} === row.claim_token` **and** the window is still open. Every
other path (unopened, opened-without-cookie, expired, saved-by-someone-else)
renders a sealed view that never receives the content.

For direct letters, the equivalent content branch lives in
[`dashboard/inbox/[id]/page.tsx`](<../src/app/(chrome)/dashboard/inbox/[id]/page.tsx>):
it first requires `receiver_id === auth user`, then applies the status/grace
checks before fetching `body` and image URLs.

The letter views live in
[`letter-views.tsx`](../src/app/[handle]/[receiver]/[letter]/letter-views.tsx).
`UnsealedView` and `SealedView` are pure presentational components — they
perform no data access, auth, or cookie checks. `LockedView` is an interactive
client component that owns the unlock POST (see below), but the security-
sensitive gating (which row, whether `body` is loaded) lives entirely in the
`LetterPage` server component. The
reveal animation wrapper
([`RevealOnce.tsx`](../src/app/[handle]/[receiver]/[letter]/RevealOnce.tsx))
receives the already-server-rendered body as React `children`, **never** as a
prop it re-fetches or re-renders — so wrapping the reveal in a client component
does not push `body` into a client payload.

## Shared-secret attempts

Invite unlocks require both factors: the random open token from the URL and the
shared-secret answer. The verify route
([`verify/route.ts`](../src/app/api/letters/[id]/verify/route.ts)) hashes the
submitted token and compares it with `letters.open_token_hash` before checking
the answer. A bad or missing token gets no answer oracle.

Answer attempts are capped durably with `letter_verify_attempts`, so spoofed IPs
and multiple server instances do not bypass the rolling limit. Direct letters
with a sender-chosen shared secret use the same attempt table from the
authenticated inbox open action.

## Invite-only signup

There is no open sign-up. An account can be created **only by keeping a letter you
received**, so the only people who get in are people someone chose to write to.
`signUpAction` ([`signup/actions.ts`](../src/app/(chrome)/signup/actions.ts))
enforces this server-side *before* creating any account: it parses the `next`
letter path, looks up the letter, and requires the request to carry the
`claim:{letterId}` cookie matching that letter's `claim_token` **and** the same
predicates the keep flow trusts (`status='opened'`, `opened_at` set, `expires_at >
now()`, `saved_by IS NULL`). No valid claim → a generic refusal, no account. The
sign-up UI is removed from the homepage, header, and login page; when `/signup`
is opened without a valid `next` and matching claim cookie, it shows an
invite-only message instead of a generic form.

## Direct letters

Direct letters (`receiver_id` set) are addressed to a known user, so their access
control is **identity-based, not bearer-link-based**:

- **Sending** is gated by `areConnected(sender, recipient)`: the client-supplied
  recipient handle is re-resolved and re-checked server-side, and self-sends are
  blocked — you can only write to an existing connection. The sender can
  optionally require a shared-secret answer before the direct letter opens.
- **Opening** is an authenticated server action gated by `receiver_id = session
  user`, optional answer verification, and an atomic status transition. The open
  starts a 24-hour grace window; saving is authorized by receiver identity and
  the still-open window. The inbox view loads `body`/images **only after** the
  `receiver_id === session user` ownership check (404 otherwise); the inbox list
  is metadata-only. An RLS policy `letters: select received by me`
  (`receiver_id = auth.uid()`) backs this as defense-in-depth, though all real
  reads go through the service-role Drizzle client.

## Redirect safety

Every post-auth `next` redirect passes through a single hardened guard
([`safe-path.ts`](../src/lib/safe-path.ts)) that accepts only true local paths —
rejecting `//host`, `/\host`, any backslash, `://`, and control characters — so
the keep-flow round-trip can't be turned into an open redirect. The guard is
applied at **every boundary** the path crosses: the login *and* signup
pages/actions, and the onboarding page/action. A raw `next` is never trusted.
(Email confirmation is disabled and `/auth/confirm` has been removed.)

## Other hardening

- **Image uploads** are validated by **magic bytes**
  ([`new/actions.ts`](<../src/app/(chrome)/new/actions.ts>)), not the client-supplied
  `file.type` — only PNG/JPEG/GIF/WEBP pass; SVG is rejected. Filenames are
  sanitized (no path separators, leading dots, or control bytes). The server
  enforces at most 5 images, 10 MB per submitted image, and 50 MB total after any
  client-side compression. Validation happens *before* any DB insert; an
  image-phase failure rolls back the letter row and uploaded objects (no orphans).
  The compose form mirrors the allowlist and limits client-side as a UX warning
  only — the server is the source of truth.
- **Letter body is rendered as escaped plain text** with `whitespace-pre-wrap`,
  never `dangerouslySetInnerHTML`.
- **Email-enumeration neutralized:** sign-up errors (including already-registered
  addresses) return a single generic "Something went wrong. Please try again."
  message — no path reveals whether the address is in use. Sign-out uses a 303
  redirect so the POST lands on `/` as a GET.
- **Slug collisions** on create are caught via the Postgres unique-violation and
  returned (not thrown) as "that letter name is taken," so the sender's draft
  survives in the mounted form.

## API keys

The app uses the current Supabase API keys:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) — browser/SSR
  clients, RLS-enforced.
- `SUPABASE_SECRET_KEY` (`sb_secret_…`) — server-only admin client; bypasses RLS.
  Guarded by `server-only` ([`admin.ts`](../src/lib/supabase/admin.ts)) so it can
  never reach the browser bundle.

`DATABASE_URL` (Drizzle), `CRON_SECRET` (the expiry job's bearer token), and
`LETTER_SECRET_PEPPER` (the HMAC pepper for shared-secret answers) are likewise
server-only. See [DEVELOPMENT.md](./DEVELOPMENT.md#environment) for the full env
list.

## The dev QA harness is not an exception

The dev-only `/dev` harness renders components with **fixture data only** and
404s in production. It is a *render* surface, not a *data* surface — it never
reaches a real letter, so it adds no attack surface. See
[DEVELOPMENT.md](./DEVELOPMENT.md#qa-harness).
