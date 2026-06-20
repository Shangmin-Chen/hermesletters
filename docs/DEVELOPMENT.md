# Development & operations

Running, building, migrating, and deploying Hermes' Letters. For how the app works,
start with [ARCHITECTURE.md](./ARCHITECTURE.md).

## Prerequisites

- Node.js 20+
- A Supabase project (Postgres + Auth + Storage)

## Setup

```bash
npm install
cp .env.example .env      # then fill in the values below
npm run db:migrate        # apply the Drizzle migrations to your database
npm run dev               # http://localhost:3000
```

## Environment

All variables are documented in [`.env.example`](../.env.example). Summary:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | `sb_publishable_…` — browser/SSR client (RLS-enforced) |
| `SUPABASE_SECRET_KEY` | **server-only** | `sb_secret_…` — admin client; bypasses RLS |
| `DATABASE_URL` | **server-only** | Postgres connection string for Drizzle |
| `NEXT_PUBLIC_SITE_URL` | public | base URL for auth email redirect links |
| `CRON_SECRET` | **server-only** | bearer token for the expiry cron (`openssl rand -base64 32`) |

> `DATABASE_URL`: the app client uses `prepare: false` for Supabase's
> transaction-mode pooler (port 6543). For running migrations, a direct,
> session-mode connection (port 5432) is recommended.

## Database & migrations

Migrations are generated and journal-tracked by Drizzle in
[`drizzle/`](../drizzle/).

```bash
npm run db:generate    # generate SQL from src/db/schema changes
npm run db:migrate     # apply pending migrations
```

`0001_rls_storage.sql` is a **hand-authored custom migration** (RLS policies +
the private storage bucket) because it references the Supabase-managed
`auth`/`storage` schemas. See [ARCHITECTURE.md](./ARCHITECTURE.md#data-model) for
the migration breakdown and the storage-bucket rationale.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | start the dev server (Turbopack) |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | generate a migration from schema changes |
| `npm run db:migrate` | apply migrations |

## QA harness

`/dev` is a **dev-only** harness for QA'ing the UI without a Supabase session or a
seeded letter — the auth gate and the need for real data otherwise make the
compose ritual and letter views hard to exercise in isolation.

- [`src/app/dev/layout.tsx`](../src/app/dev/layout.tsx) returns `notFound()` when
  `NODE_ENV === 'production'`, so the whole subtree 404s in prod.
- Every route renders real components with **fixture props only** — no auth, no
  database. It's a *render* surface, not a *data* surface, so it's not a security
  hole (see [SECURITY.md](./SECURITY.md#the-dev-qa-harness-is-not-an-exception)).

| Route | Renders |
|---|---|
| `/dev` | index of the harness routes |
| `/dev/compose` | the full compose ritual (drive the fold here) |
| `/dev/locked` | the locked sealed-envelope view |
| `/dev/unsealing` | the wax-unseal press-and-hold interaction, with a replay control |
| `/dev/unsealed` | the reveal + letter-on-paper, with a "Replay reveal" button |
| `/dev/sealed` | the already-opened / closed view |

> Note on automated QA: a headless/hidden browser freezes the document timeline
> and throttles `requestAnimationFrame`, so the fold's live *playback* can only be
> eyeballed in a visible browser — though its structure can be verified by seeking
> the Web Animations API. The harness still unblocks all static/layout QA without
> auth.

## Conventions

- **Keep the data-access split.** Server-only secrets and sensitive reads go
  through Drizzle/service-role behind `server-only`; never widen what reaches an
  unauthenticated client. Re-read [SECURITY.md](./SECURITY.md) before touching the
  letter page, verify, or save paths.
- **Reference code by file and symbol, not line number,** in docs — line numbers
  rot.
- **Honor reduced motion** in any new animation: gate CSS keyframes in the
  `prefers-reduced-motion` block *and*, for JS/WAAPI animations, check
  `matchMedia` directly.

## Deployment

Hosted on **Vercel** with **Supabase** as the backend.

- Set all environment variables (above) in the Vercel project, with the
  server-only ones unexposed to the client.
- The expiry job is wired in [`vercel.json`](../vercel.json) as a cron hitting
  `/api/cron/expire` **daily at midnight** (`0 0 * * *`). It authenticates with
  `CRON_SECRET` (bearer token) and **denies by default if the secret is unset** —
  so a missing `CRON_SECRET` fails closed rather than leaving the endpoint open.
- Apply migrations against the production database (`npm run db:migrate` with a
  production `DATABASE_URL`) before or during deploy.
