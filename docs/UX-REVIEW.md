# UX & Navigation Review — Hermes' Letters

A review of the live interface and navigation patterns, written for a
design-focused audience. Issues are ordered by likely impact on the user
experience, not by how hard they are to fix. Each item states the problem, why
it matters, and a specific fix.

> Scope note: this reviews the code as it actually ships today (post "Simplify
> UI" commit). `docs/PRODUCT.md` still describes an elaborate write→fold→address→seal
> ritual with `PaperScene`/`EnvelopeScene`/`SealScene`/`FoldClone` components that
> no longer exist in `src/app/new/`. The doc/product drift is itself a problem
> (see #2 and #11).

---

## P0 — Breaks core expectations

### 1. There is no way to sign out
**Problem.** A `/auth/signout` route exists, but nothing in the entire UI links
to it (`grep` for signout/log out across `src/app` + `src/components` returns
nothing). Once logged in, the user is stuck logged in.
**Why it's a problem.** Sign-out is a baseline expectation of any
authenticated product; its absence reads as broken or untrustworthy, and it's a
real problem on shared/public computers given the app's privacy-first framing.
**Fix.** Add a persistent account control (see #3) containing the user's
handle and a "Sign out" action that POSTs to `/auth/signout`. At minimum, put a
sign-out link in the dashboard header.

### 2. The app speaks in two different visual languages
**Problem.** The recipient-facing pages — `letter-views.tsx`, `error.tsx`,
`not-found.tsx`, `check-email`, `received/[id]` — render the intended
"paper-and-ink" world: `font-serif`, `text-wax`, the `Envelope`/`Wordmark`
brand marks, `animate-rise-in`, themed `bg-card` surfaces. The core
sender-facing flow does not: the landing page is hardcoded `bg-white`, the
dashboard is `bg-gray-50`, and `/new`, `/login`, `/signup`, `/onboarding`, and
`/new/created` are unstyled default shadcn cards with sans-serif type and no
brand mark.
**Why it's a problem.** For a design-focused audience this is the headline
issue. The product's entire promise is that sending a letter should "feel like
handling a physical letter, not filling in a web form" — yet the composing and
account screens *are* exactly a web form, while only the reading screens deliver
the atmosphere. The seam is jarring: users cross from a generic SaaS admin panel
into a candlelit letter and back. It also undercuts brand trust at precisely the
moments (signup, compose) where you're asking for commitment.
**Fix.** Apply the design tokens and brand chrome consistently. Remove
hardcoded `bg-white`/`bg-gray-50`; let `body` carry the themed atmosphere layer
everywhere. Use `font-serif` headings, the `Wordmark`, and the same themed card
treatment on the landing page, dashboard, compose, and auth screens.

### 3. No global navigation or persistent brand chrome
**Problem.** `layout.tsx` renders only `{children}`. Every screen is an
isolated centered card with no header, no wordmark, no nav. The `Wordmark`
appears on just three pages (error, not-found, check-email).
**Why it's a problem.** Users have no consistent "where am I / how do I get
back / who am I logged in as" anchor. After composing, the only way back to the
dashboard is an in-content button; there's no home affordance from most
screens; and the brand identity vanishes for the entire authenticated core.
This is the structural cause of #1 and #2.
**Fix.** Add a slim shared header in `layout.tsx` (or an authed-section
layout): `Wordmark` linking home on the left, and on the right either
Sign in / Get started (logged out) or handle + Sign out (logged in). This
single change resolves sign-out, home navigation, and brand persistence at
once.

---

## P1 — High friction in the primary flow

### 4. The share link is unrecoverable, and its only "save" affordance can fail silently
**Problem.** `/new/created` is described as "the one chance to copy the share
link" — sent letters are never stored. Yet (a) there is no `beforeunload` guard
(the PRODUCT doc claims one; the code has none), so a stray back/refresh loses
the link forever, and (b) `CopyLinkButton` swallows clipboard failures: on a
non-secure context or denied permission it calls `setCopied(false)` and shows
*nothing* — no error, no fallback.
**Why it's a problem.** This is the highest-stakes, least-reversible moment in
the app. Losing the link means the letter is gone with no recovery path. A copy
button that can no-op without telling the user is a missing feedback state on
the one action that matters most.
**Fix.** (a) Add a `beforeunload` confirmation until the link is copied/shared.
(b) On clipboard failure, select the URL text and show "Press ⌘/Ctrl+C to copy"
plus an error state, rather than silently doing nothing. (c) Consider an
explicit "I've saved this link" confirmation before offering "Write another."

### 5. The emotional core — composing — is a flat, undifferentiated form
**Problem.** `/new` stacks every field on one screen: receiver name, letter
name, URL preview, body (`rows={8}` textarea), question, answer, images, submit.
There's no sense of "writing a letter," no separation between *the message* and
*the lock/logistics*.
**Why it's a problem.** Writing the letter is the heart of the experience and
deserves the most care; instead it gets the least. Cramming the intimate act
(the body) next to plumbing (slug previews, file inputs) flattens the emotional
register the rest of the app works hard to build. The body textarea is small and
visually identical to the one-line metadata inputs.
**Fix.** At minimum, give the body a generous, paper-styled writing surface
(serif, auto-grow, visually distinct) and visually group it apart from the
"address + seal" logistics. If staged composition is too much to restore, a
clear two-block layout ("Your letter" / "Lock & address it") recovers most of
the intent cheaply.

### 6. Calling the lock a "Security question" with a password "Answer" field misframes the feature
**Problem.** The compose form labels the prompt "Security question" and renders
the answer as `<input type="password">`.
**Why it's a problem.** The product framing is poetic — "something only the two
of you know." "Security question" is the language of account-recovery forms, and
a masked password field signals "credential," not "a shared memory." It also
means the sender can't see what they typed to sanity-check it, on a field that
is case-insensitive and unrecoverable after send.
**Fix.** Rename to match the reader-side voice (e.g. "A question only they can
answer" / "The answer"). Make the answer a normal text input with an optional
show/hide toggle, and surface the same "they'll only see its length and spaces"
reassurance shown on the locked page.

### 7. Image upload has no preview, list, size guidance, or progress
**Problem.** The images input is a bare `<input type="file" multiple>`. No
thumbnails, no selected-file list, no per-file size limit shown, and on submit
the only signal is the button reading "Sending…" — which can sit for a long time
while images upload.
**Why it's a problem.** Users can't confirm *what* they attached or *whether*
anything is happening during a potentially slow upload, inviting double-submits
and anxiety on the unrecoverable send. "Images appear below the letter once
unlocked" is also unverifiable at compose time.
**Fix.** Render thumbnail previews with remove buttons, show accepted
types/size limits up front, and give the submit a real progress/disabled state
("Sealing your letter…") so the wait is legible.

---

## P2 — Affordances & feedback gaps

### 8. Handle availability is only validated on submit
**Problem.** Onboarding shows a live *slug preview* but never checks
availability; a collision surfaces only after submitting.
**Why it's a problem.** The handle "cannot be changed later," so this is a
high-commitment field — discovering it's taken after submit is avoidable
friction at a one-time decision point.
**Fix.** Debounced availability check against reserved/taken handles with an
inline "available / taken" indicator before submit.

### 9. Landing page doesn't explain the one thing that makes this special
**Problem.** The hero says "Write a private letter. Lock it behind a secret only
they know." It never conveys the core mechanic — *opens once, then it's gone* —
that defines the product.
**Why it's a problem.** The open-once / burn-on-open tension is the entire
reason this exists; omitting it makes the app read as a generic "password-protected
note" and undersells the emotional hook to first-time visitors.
**Fix.** Add one line of supporting copy (e.g. "It opens once — for the one
person it was meant for, then it's gone.") and consider a 3-beat "write → seal →
it opens once" explanation.

### 10. Plain link navigations have no pending/loading feedback
**Problem.** Form submits get pending states ("Logging in…", "Sending…"), but
`<Link>` navigations to server components — "Write a letter," "Go to dashboard,"
opening a kept letter — give no feedback while the server renders.
**Why it's a problem.** On a cold server render the click can feel unresponsive,
prompting re-clicks. The polish of the inline states makes the bare links feel
inconsistent by comparison.
**Fix.** Add `loading.tsx` route segments for `/dashboard`, `/new`, and
`/dashboard/received/[id]`, or use `useLinkStatus`/transition-based pending
styling on primary nav buttons.

### 11. Empty dashboard is a quiet dead-end
**Problem.** A new user's dashboard shows "Kept letters (0) — No kept letters
yet." Since sent letters are intentionally not stored, that's genuinely all
there is, but the empty state offers no narrative or onward nudge beyond the
"Write a letter" button above it.
**Why it's a problem.** The emptiness can read as "nothing works / where did my
sent letter go?" — especially because the app deliberately keeps no record of
sent letters, which is surprising and unexplained here.
**Fix.** Make the empty state explain the model ("Letters you send aren't kept
here — only letters you open and choose to keep.") so the absence is intentional,
not confusing.

### 12. Dark mode is defined but unreachable on the hardcoded-light pages
**Problem.** The theme system defines a full dark mode ("candlelit cabin"), but
landing (`bg-white`) and dashboard (`bg-gray-50`) hardcode light backgrounds, and
there's no theme toggle anywhere.
**Why it's a problem.** A design audience will notice that the showcased dark
theme never appears in the primary flow, and that pages don't respect system
preference consistently.
**Fix.** Remove hardcoded backgrounds (#2) so all pages inherit the themed
surface, and add an optional theme toggle in the header (#3).

---

## What's already working well

- **`AnswerInput`** is the strongest component: idle/loading/incorrect/
  already-opened/expired/rate-limited states, a cooldown timer, text re-selected
  on a near-miss, terminal dead-ends that offer an exit instead of a silently
  dead input, and warm, on-brand microcopy.
- **Reveal discipline** — the body is server-rendered and readable from the
  first frame; only the envelope chrome animates. Never making someone wait to
  read an emotional letter is exactly right.
- **Error / not-found / check-email** screens are on-brand, reassuring, and
  give a clear way forward.
- **Accessibility fundamentals**: `role="alert"` on errors, reduced-motion
  honored, 44px touch targets on key links, `aria-pressed` on the copy button.

## Suggested sequencing

1. Shared header with sign-out + wordmark (#1, #3) — one change, three wins.
2. Unify the visual language across the sender flow (#2, #12).
3. Harden the unrecoverable send: beforeunload + copy-failure feedback (#4).
4. Elevate the compose surface and reframe the lock (#5, #6, #7).
5. Polish: handle availability, landing copy, link loading states, empty state (#8–#11).
