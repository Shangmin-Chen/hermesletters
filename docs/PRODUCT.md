# The experience

Hermes Letters is meant to feel like handling a physical letter, not filling in a
web form. This document describes the writing and reading experiences and the
theming that carries them. For the underlying mechanics see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Writing — the letter ritual

Composing mirrors the emotional shape of writing a letter: **write it → add
photos → seal it → address and send.** Implemented in
[`new-letter-form.tsx`](<../src/app/(chrome)/new/new-letter-form.tsx>) as a
single progressively-enhanced `<form>` with all inputs always mounted; the steps
are `hidden`-toggled `<section>`s, so `FormData`, the draft, and the selected
files survive every step change.

| Step | Scene | Fields |
|---|---|---|
| 1 | **Write** | the letter `body` on a generous serif writing surface |
| 2 | **Photos** | up to 5 optional images, each with an optional **caption** |
| 3 | **Seal** | press-and-hold the **wax seal** to seal the letter |
| 4 | **Send** | `receiver_name` (To), `letter_name` (label), shared-secret prompt + answer, live URL preview |
| → | **Sent** (`/new/created`) | the one chance to copy the share link (persistent "copied" state + `beforeunload` guard) |

> **Direct mode** (`/new?to=<handle>`, from the phonebook): the recipient is a
> locked, server-validated connection instead of a free-text name, there is no URL
> preview, and the sender chooses whether to add a shared-secret prompt. It opens
> into the same 24h keep-or-expire grace window — see
> [ARCHITECTURE.md](./ARCHITECTURE.md#direct-letters--the-phonebook). Confirmation
> is `/new/sent` (no share link).

**The seal.** The compose flow uses the same hold-to-commit language as reading:
the sender presses and holds a wax seal before the final address/send step.
Reduced-motion users can complete the gesture without waiting on animation, and
the sender can break the seal to revise the letter before submitting.

**Safety and correctness baked in:**

- **Validation parity:** the per-step gates and the server action import the same
  predicates from [`letter-validation.ts`](../src/lib/letter-validation.ts), so a
  bad slug (e.g. emoji-only) is caught at the owning step, not after submit.
- **Error → step routing:** `createLetterAction` returns an optional `field` on
  failure; a server error (e.g. the duplicate-name collision, which is only
  detectable at insert time) jumps the wizard back to the step that owns it and
  focuses the message — never stranding the user on the wrong scene.

## Reading — opening a letter

Receiving is the inverse ritual, in
[`page.tsx`](../src/app/[handle]/[receiver]/[letter]/page.tsx) and
[`letter-views.tsx`](../src/app/[handle]/[receiver]/[letter]/letter-views.tsx):

1. **Locked** — a sealed wax envelope on the desk. Invite letters require the
   original tokenized link and a shared-secret answer; direct letters may require
   a shared secret if the sender chose one. The recipient answers the prompt,
   then presses and holds the wax seal (750 ms, or keyboard Enter/Space) via
   [`WaxUnseal`](../src/components/letter/WaxUnseal.tsx); a charging ring fills
   as they hold.
2. **Reveal** — on a successful unlock, `LockedView` sets a one-shot
   `sessionStorage` flag and refreshes; the server re-renders the unsealed view,
   and [`RevealOnce`](../src/app/[handle]/[receiver]/[letter]/RevealOnce.tsx)
   plays a brief (~≤800ms) envelope-chrome animation **once**, then clears the
   flag so re-reads within the grace window don't replay it.
3. **Unsealed** — the letter on a paper sheet, with the expiry, a live countdown,
   and the keep-flow footer.

A deliberate rule governs the reveal: **the body is server-rendered and readable
from the first frame.** Only the envelope *chrome* animates — the app never makes
someone wait to read an emotional letter.

Once open, an invite letter's keep-flow footer is honest about the mechanics: the
claim is bound to this browser via a cookie, so it can't follow you to
incognito/another device, and it lapses after 24h. **Direct letters** are opened
from the dashboard **You've got mail** inbox by the addressed account and use the
same keep-or-expire lifecycle. Photos in either kind render in a
[`PhotoGallery`](../src/components/letter/PhotoGallery.tsx) grid + lightbox, each
showing its optional caption. Compose accepts up to 5 images; large images may be
compressed before sending, and the server enforces 10 MB per submitted image and
50 MB total.

## Theming

The visual system is a cozy, vintage paper-and-ink world, defined with `oklch`
design tokens in [`globals.css`](../src/app/globals.css) (`--paper`, `--ink`,
`--wax`, …):

- **Dark mode — a candlelit wood cabin on a snowy night.** Warm amber surfaces, a
  layered lamp/candle light-pool pooling from the upper-right into inky vignetted
  corners, a faint wood/paper grain, and a subtle candle-flicker.
- **Light mode — a London brownstone morning.** Sunlit ivory, a soft warm
  sun-pour from the top, and cards that read brighter than the page like paper
  catching the light.

Atmosphere is painted on a fixed `body::before` (GPU-cheap gradients) with a faint
SVG grain on `body::after`; the brand animations (rise-in, unfold, seal-break,
wax-pulse, flap-open, and seal-flight) live alongside the tokens.

## Accessibility

- **Reduced motion** is honored throughout: a CSS `prefers-reduced-motion` block
  disables the keyframe animations, and the JS-driven seal/reveal interactions
  consult `matchMedia` directly. Every ritual is completable with motion fully
  off.
- The compose wizard manages **focus per step** (focus moves to the new scene's
  heading) with a single polite `aria-live` announcement, and the borderless
  paper field keeps a visible focus ring meeting non-text contrast.
- Letter body is escaped plain text (`whitespace-pre-wrap`, no `dangerouslySetInnerHTML`).
