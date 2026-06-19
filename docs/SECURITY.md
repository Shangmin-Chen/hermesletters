# Security model

Hermes' Letters's entire value proposition is access control: *a link anyone can
hold, content only one person can ever take.* This document is the authoritative
reference for how that's enforced. For the mechanics it protects (lock, claim,
grace), see [ARCHITECTURE.md](./ARCHITECTURE.md).

## The core invariant

> **`body` and `claim_token` never reach an unauthenticated client.**

Everything below exists to uphold that one sentence.

## The data-access split

Two data paths, deliberately separated:

- **Drizzle (direct Postgres, secret key, bypasses RLS)** — schema, migrations,
  and all sensitive server-only logic: the locked-page read, verify, atomic
  claim, save, and the Received-mail content fetch. Each query **selects only the
  columns it needs** for the decision at hand (verify never selects `body`; the
  Received page authorizes on `saved_by` first, then a *second* query pulls
  `body`).
- **Supabase JS client (RLS-enforced)** — auth and RLS-protected client reads.
  Senders can `INSERT` letters scoped to themselves but **never read them back**
  (no sent-history). Saved letters are readable only by `saved_by = auth.uid()`.
  `letter_images` has RLS on with **no client policy** (default-deny).

## The single validated branch

`body` and signed image URLs enter the React render tree in exactly **one**
place: the cookie-validated grace branch of
[`page.tsx`](../src/app/[handle]/[receiver]/[letter]/page.tsx), where
`cookie.claim:{id} === row.claim_token` **and** the window is still open. Every
other path (unopened, opened-without-cookie, expired, saved-by-someone-else)
renders a sealed view that never receives the content.

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

## Rate limiting

With the security-question challenge removed, the unlock flow has no secret to
brute-force: the verify route
([`verify/route.ts`](../src/app/api/letters/[id]/verify/route.ts)) authorizes a
claim solely by possession of the unguessable letter URL (and its `claim_token`),
and the claim is written under an atomic `saved_by IS NULL` guard that makes
replay harmless. The former per-attempt rate limit (and the
`letter_verify_attempts` table that backed it) was therefore retired alongside
the question challenge.

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
  ([`new/actions.ts`](../src/app/new/actions.ts)), not the client-supplied
  `file.type` — only PNG/JPEG/GIF/WEBP pass; SVG is rejected. Filenames are
  sanitized (no path separators, leading dots, or control bytes). Validation
  happens *before* any DB insert; an image-phase failure rolls back the letter
  row and uploaded objects (no orphans). The compose form mirrors the allowlist
  client-side as a UX warning only — the server is the source of truth.
- **The secret answer is never persisted client-side.** The compose form
  autosaves only the non-secret fields (receiver, letter name, body, question) to
  `localStorage`; the answer is excluded by construction.
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

`DATABASE_URL` (Drizzle) and `CRON_SECRET` (the expiry job's bearer token) are
likewise server-only. See [DEVELOPMENT.md](./DEVELOPMENT.md#environment) for the
full env list.

## The dev QA harness is not an exception

The dev-only `/dev` harness renders components with **fixture data only** and
404s in production. It is a *render* surface, not a *data* surface — it never
reaches a real letter, so it adds no attack surface. See
[DEVELOPMENT.md](./DEVELOPMENT.md#qa-harness).
