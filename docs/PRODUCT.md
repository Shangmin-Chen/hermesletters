# The experience

Hermes' Letters is meant to feel like handling a physical letter, not filling in a
web form. This document describes the writing and reading experiences and the
theming that carries them. For the underlying mechanics see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Writing — the letter ritual

Composing mirrors how people actually write a letter: **write it → fold it into
an envelope → address it → seal it → send.** Implemented in
[`src/app/new/`](../src/app/new/) as a single progressively-enhanced
`<form action={createLetterAction}>` ([`ComposeLetter.tsx`](../src/app/new/ComposeLetter.tsx))
with all inputs always mounted; the steps are `hidden`-toggled `<section>`s, so
`FormData`, the draft, and the selected files survive every step change.

| Step | Scene | Fields |
|---|---|---|
| 1 | **Paper** ([`PaperScene`](../src/app/new/PaperScene.tsx)) | the letter `body` on a borderless serif writing surface (auto-grow), optional photo tuck-in |
| 2 | **Envelope** ([`EnvelopeScene`](../src/app/new/EnvelopeScene.tsx)) | `receiver_name` (To), `letter_name` (label) + live URL preview, read-only From @handle |
| 3 | **Seal** ([`SealScene`](../src/app/new/SealScene.tsx)) | `question` + `answer` (show/hide), and a [`ReviewSummary`](../src/app/new/ReviewSummary.tsx) of everything before sealing |
| → | **Sent** (`/new/created`) | the one chance to copy the share link (persistent "copied" state + `beforeunload` guard) |

**The fold.** Pressing "Fold the letter" plays a Web Animations API **Z-fold** of
a static, sliced-text clone of the page
([`FoldClone.tsx`](../src/app/new/FoldClone.tsx)): the middle third anchors while
the top and bottom thirds rotate inward, then the folded stack tucks into the
envelope. It's clipped with `clip-path` (not `overflow`) so the 3-D `preserve-3d`
context isn't flattened, orchestrated off animation `.finished` (no timers), and
**skippable** with any tap/keypress. Reduced-motion, mobile, and very long
letters fall back to a cheap shrink-drop or an instant cut — chosen by a JS
`matchMedia` check, because a CSS media query can't stop a JS-driven animation.

**Safety and correctness baked in:**

- **Draft autosave** to `localStorage` for receiver/letter/body/question — **never
  the answer** (see [SECURITY.md](./SECURITY.md)).
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

1. **Locked** — a sealed wax envelope on the desk, the question framed as
   *"something only the two of you know,"* and the answer-shape slots.
2. **Reveal** — on a correct answer,
   [`AnswerInput`](../src/app/[handle]/[receiver]/[letter]/AnswerInput.tsx) sets a
   one-shot `sessionStorage` flag and refreshes; the server re-renders the
   unsealed view, and [`RevealOnce`](../src/app/[handle]/[receiver]/[letter]/RevealOnce.tsx)
   plays a brief (~≤800ms) envelope-chrome animation **once**, then clears the
   flag so re-reads within the grace window don't replay it.
3. **Unsealed** — the letter on a paper sheet, with the expiry, a live countdown,
   and the keep-flow footer.

A deliberate rule governs the reveal: **the body is server-rendered and readable
from the first frame.** Only the envelope *chrome* animates — the app never makes
someone wait to read an emotional letter.

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
wax-pulse, flap-open, the fold) live alongside the tokens.

## Accessibility

- **Reduced motion** is honored throughout: a CSS `prefers-reduced-motion` block
  disables the keyframe animations, and the JS-driven fold/reveal consult
  `matchMedia` directly (a CSS query can't stop a Web Animation). Every ritual is
  completable with motion fully off.
- The compose wizard manages **focus per step** (focus moves to the new scene's
  heading) with a single polite `aria-live` announcement, and the borderless
  paper field keeps a visible focus ring meeting non-text contrast.
- Letter body is escaped plain text; the answer input surfaces its character
  count once and never leaks per-character feedback.
