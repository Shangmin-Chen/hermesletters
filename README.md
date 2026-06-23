# Hermes Letters

Write something real. Seal it with a shared secret. Share it once — it opens
once.

Hermes Letters is a full-stack Next.js + Supabase app for sending **virtual
letters**. A signed-in sender writes a letter (text + optional images), seals it
behind a shared-secret prompt, and shares a human-readable link carrying a random
open token. The recipient needs both the sealed link and the answer — but a
letter **opens only once**. After the first correct open it belongs to the opener
(if they sign in within 24 hours) or it expires. The sender keeps no readable
copy or sent-mail record: every letter is **fire-and-forget and burns on open**.

The whole app turns on one tension: **a link anyone can hold, content only one
person can ever take.**

## Stack

Next.js (App Router, TypeScript) · React · Tailwind CSS v4 · shadcn/ui ·
Supabase (email + password auth, Postgres + RLS, private Storage) · Drizzle ORM ·
deployed on Vercel.

## Quickstart

```bash
npm install
cp .env.example .env      # fill in your Supabase + app values
npm run db:migrate        # apply migrations to your database
npm run dev               # http://localhost:3000
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full environment, scripts,
migrations, and deployment.

Want to look at the UI without logging in? Visit **`/dev`** — a dev-only QA
harness that renders every screen with fixture data (it 404s in production).

## Documentation

| Doc | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works: the lock, the atomic open-once claim, the 24h grace window, lifecycle, data model, routes, project layout |
| [docs/SECURITY.md](docs/SECURITY.md) | The threat model and the data-access split — how `body`, shared-secret hashes, open-token hashes, and `claim_token` are kept from unauthenticated clients |
| [docs/PRODUCT.md](docs/PRODUCT.md) | The experience: the compose ritual (write → photos → seal → send), the reading reveal, theming, accessibility |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, environment, migrations, the `/dev` QA harness, conventions, deployment |

## How it works, in one paragraph

A sender composes a letter through a staged ritual — write it on a blank sheet,
seal it with a shared-secret prompt, address it, and gets a shareable URL
(`/{handle}/{receiver}/{letter}?t=<token>`). The locked page only appears when the
random token matches; it ships the prompt and the *shape* of the answer, never the
answer itself. A correct answer fires a single conditional `UPDATE … WHERE
opened_at IS NULL`, so exactly one person becomes the opener; their browser gets
an httpOnly claim cookie and the letter content is rendered only in that
cookie-validated branch. The opener has 24 hours to sign in and keep the letter
forever; otherwise a nightly cron expires it. The sender never sees it again.
