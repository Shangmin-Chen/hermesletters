# Send a Letter — Spec

A full-stack app for sending **virtual letters**. A sender writes a letter (text + images), locks it behind a personal security question, and shares a readable URL. Anyone with the link can attempt to unlock it — but a letter can be **opened only once**, after which it belongs to the opener (if they log in) or expires in 24 hours. The sender keeps no copy and cannot preview without consuming the open — **opening always burns the letter**.

## Stack
- **Framework:** Next.js (App Router) + TypeScript
- **UI:** React, Tailwind CSS, shadcn/ui
- **Backend / DB / Auth / Storage:** Supabase
  - Auth: **email + password** (Supabase Auth) for both senders and receivers. (Google OAuth can be added later as an extra provider.)
  - DB: Postgres with **Row Level Security**
  - Storage: **private bucket** for letter images, served via **signed URLs**
- **ORM / migrations:** **Drizzle** + `drizzle-kit` (typed schema, generated SQL migrations, server-side queries)
- **SSR auth glue:** `@supabase/ssr`

### Data-access split
- **Drizzle** (direct Postgres connection): schema definition, migrations, and all **server-side / service-role** logic — locked-page reads, atomic claim, verify, save. These bypass RLS by design and must stay server-only.
- **Supabase JS client**: authentication and **RLS-protected client reads** (e.g. Received mail). Never used to read `body` / `answer_normalized` / `claim_token` from an unauthenticated client.

## Roles & auth
- **Sender** — must be signed in (email + password). Picks a stable **handle** once, creates letters. Keeps **no copy** and gets **no record** of letters sent (fire-and-forget).
- **Opener / receiver** — can view and attempt to unlock a letter **without an account**. To **keep** an opened letter, they must sign in (email + password) within the 24h window.

---

## URL scheme
```
site.com/{sender-handle}/{receiver-name}/{letter-name}
```
- All three segments are **slugified** on input: lowercase, spaces → dashes, illegal characters rejected, empties rejected.
- **Sender handle** is chosen once at onboarding and is stable (independent of the Google display name) so URLs never break.
- **Uniqueness** is enforced on the full triple `(sender_handle, receiver_name, letter_name)`. If the combination already exists, creation is **rejected** at save time with a "that letter name is taken" message. No silent suffixing.

---

## The lock (security-critical)
A locked letter must be genuinely locked — not just visually hidden.

1. The locked page is server-rendered and sends the visitor **only**:
   - the security **question**
   - the answer's **shape** — its length and the position of spaces — so the UI can render an underline per character, with real spaces left blank. The answer text itself is **never** sent to the client.
2. A guess is submitted to a **server Route Handler**. The body and image URLs are returned **only on a correct answer**, never in the initial page payload or JS bundle.
3. **Answer matching:** case-insensitive + outer-whitespace trim; inner spaces and punctuation preserved in the compare. Intentionally guessable, but predictable.
4. **Rate limiting** on the verify route (per-letter, per-IP) so the guessable design can't be brute-forced.
5. One security question per letter. **No hint.**

> The underline UI is purely a length/space hint derived from the answer's stored shape. Revealing length is intended; revealing the answer is not.

---

## Open-once lifecycle
A letter has exactly one of these states:

| State | Meaning |
|-------|---------|
| **unopened** | Never solved. Anyone can view the locked page and attempt the answer. |
| **opened (grace)** | Solved once. Viewable **only** by the opener's browser, for 24h. |
| **saved** | Opener logged in during grace. Belongs to them permanently; no expiry. |
| **expired** | Grace window passed without a login. Inaccessible to everyone. |

**Atomic claim (no races):** the verify route opens a letter with a single conditional update —
`UPDATE letters SET opened_at = now(), claim_token = <new uuid>, expires_at = now() + 24h WHERE id = <id> AND opened_at IS NULL RETURNING *`.
The caller that gets a row back is the opener. A simultaneous second correct guess finds `opened_at` already set, gets no row, and is shown **"this letter has already been opened."**

**Surviving the 24h window.** On a successful claim the opener's browser receives a **`claim_token` cookie** scoped to that letter, lasting the full 24h grace. Refresh / lost connection / reopened tab → the same browser re-reads because its cookie matches `claim_token`. No one else can view the letter, even with the correct answer — only the cookie holder. Losing the cookie before logging in (incognito, cleared cookies) means losing access; the escape hatch is to **log in immediately after opening** to persist it.

**Keeping it:** signing in **within the 24h window** sets `saved_by = user id` and `saved_at`, which exempts the letter from expiry and surfaces it in the opener's **Received mail**. The row simply becomes theirs — no copy is made.

**Expiry:** after 24h with no save, the letter is **marked expired** (`status = expired`). Data is retained but inaccessible to everyone. (A scheduled job flips the flag; access is also guarded at read time so an un-flipped-but-past-due letter still reads as expired.)

---

## Letter content
- **Plain text body** + a **separate image gallery** (images shown below the text, not inline).
- **No upload limits** on image count or size.
- Images stored in a **private** Supabase bucket, pathed under the owning letter.
- On a successful unlock (or for a saved-letter view), the server mints **time-limited signed URLs** for the letter's images and returns them with the body.

---

## Dashboard
Sender keeps no copy and no sent-history, so the dashboard has two parts only:
- **Send mail** — the compose form (no list of past sends).
- **Received mail** — letters the user has saved (`saved_by = me`), readable indefinitely.

---

## Locked-page design
- Rendered as the **shape of a letter / envelope** with a **lock in the middle**.
- Lock area holds: the question and the **underline answer input** (one underline per answer character, spaces blank). No hint.
- On correct answer the letter "unseals" to reveal body + image gallery.
- Already-opened / expired states show a closed, sealed-shut letter with the appropriate message.

---

## Data model (initial)

**profiles**
- `id` (uuid, = auth.uid, PK)
- `handle` (text, unique, stable)
- `display_name`, `avatar_url`
- `created_at`

**letters**
- `id` (uuid, PK)
- `sender_id` (uuid → profiles.id)
- `sender_handle` (text, denormalized for URL lookup)
- `receiver_name` (text, slug)
- `letter_name` (text, slug)
- `body` (text)
- `question` (text)
- `answer_normalized` (text — lowercased/trimmed; for comparison)
- `answer_shape` (json/text — lengths + space positions for underline rendering; never exposes the answer)
- `opened_at` (timestamptz, null until first claim)
- `claim_token` (uuid, null until first claim)
- `expires_at` (timestamptz, null until opened)
- `saved_by` (uuid → profiles.id, null)
- `saved_at` (timestamptz, null)
- `status` (enum: `unopened` | `opened` | `saved` | `expired`)
- `created_at`
- **Unique constraint:** `(sender_handle, receiver_name, letter_name)`

**letter_images**
- `id` (uuid, PK)
- `letter_id` (uuid → letters.id)
- `storage_path` (text, in private bucket)
- `position` (int)

> No `letter_events` table — view/unlock tracking is intentionally dropped (sender keeps no record).

### RLS sketch
- `profiles`: user reads/writes only their own row.
- `letters`:
  - **Senders never read back** their letters (no copy). Insert only, scoped to `sender_id = auth.uid`.
  - **Saved letters** are readable by `saved_by = auth.uid` (Received mail).
  - The **locked page, verify, and grace-window reads** all go through **server-side code** (route handlers / service role) — `body`, `answer_normalized`, and `claim_token` never reach an unauthenticated client. The locked page exposes only question + answer shape; verify returns body only on success and only to the claimant.
- `letter_images`: never read directly by clients; signed URLs are minted server-side after a valid unlock or saved-letter view.

---

## Routes
- `/` — landing.
- `/signup`, `/login` — email + password auth.
- `/onboarding` — pick handle (first sign-in for a sender).
- `/dashboard` — Send mail (compose) + Received mail (saved letters).
- `/new` — create-letter form: receiver name, letter name, body, image upload, question, answer. Slug + uniqueness validation on submit.
- `/{handle}/{receiver}/{letter}` — locked / opened / expired letter view (the envelope-with-lock page).
- **Route handler** `POST /api/letters/[id]/verify` — rate-limited; checks answer; performs atomic claim; sets `claim_token` cookie; returns body + signed image URLs on success.
- **Route handler** `POST /api/letters/[id]/save` — requires auth + valid grace + matching claim cookie; sets `saved_by` / `saved_at`.
- **Scheduled job** — flips past-due `opened` letters to `expired` (with read-time guard as backup).

---

## Open items for the UI/UX pass
- Exact envelope/lock visual treatment and the unseal animation.
- Underline answer-input interaction details.
- Dashboard layout and empty states.
- Rate-limit thresholds and the cookie's exact max-age handling.
