"use client";

import React, { useId } from "react";
import { SealMarkGeometry } from "./SealMark";

export interface EnvelopeProps {
  /** "sealed" shows a closed envelope with a wax seal; "open" shows the flap raised */
  state?: "sealed" | "open";
  className?: string;
  /** When true, marks the SVG as purely decorative (aria-hidden="true").
   *  Also drops role/aria-labelledby so screen readers skip it entirely. */
  "aria-hidden"?: boolean;
  /** When true (and state="sealed"), applies the idle breathing pulse to ONLY
   *  the wax-seal group — the ink line art stays still. The seal group scales
   *  in place (transform-origin at the seal center). Additive: call sites that
   *  wrap the whole SVG in `.animate-wax-pulse` keep working unchanged. */
  animateSeal?: boolean;
  /** When false (and state="sealed"), draws the closed envelope WITHOUT the wax
   *  seal — an empty flap, ready to receive a seal. Used by the seal-step
   *  ceremony where the seal is a separate DOM element that flies into place.
   *  Defaults to true so every other call site is unaffected. */
  showSeal?: boolean;
}

/**
 * Envelope — brand SVG illustration for Hermes' Letters.
 *
 * Uses `currentColor` for ink lines so it inherits text color in any context.
 * The wax-seal circle uses `var(--wax)` directly — a muted sealing-wax red, the
 * one saturated accent against the otherwise paper-and-ink (achromatic) palette.
 *
 * The wax seal delegates to `<SealMarkGeometry>` (single source of truth for
 * the rosette / ring / hub artwork). The `<g data-seal>` group inside it is
 * independently targetable so animations affect only the seal, not the ink
 * line art. Apply `.animate-seal-break` to that group for the unlock pop, or
 * pass `animateSeal` for the idle breathing pulse on the seal alone. Use
 * `.animate-flap-open` on the SVG for the flap-open reveal.
 *
 * @example
 *   <Envelope state="sealed" className="w-24 h-24" />
 *   <Envelope state="open"   className="w-24 h-24 text-ink" />
 *   <Envelope state="sealed" animateSeal />    // seal-only breathing pulse
 *   <Envelope state="sealed" aria-hidden />    // decorative — fully hidden
 */
export function Envelope({
  state = "sealed",
  className = "",
  "aria-hidden": ariaHidden,
  animateSeal = false,
  showSeal = true,
}: EnvelopeProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId  = `${uid}-desc`;

  const isOpen = state === "open";
  const isDecorative = ariaHidden === true;

  const titleText = isOpen ? "Open envelope" : "Sealed envelope with wax seal";
  const descText = isOpen
    ? "An envelope with the flap raised, ready to reveal its letter."
    : "A closed envelope sealed with a wax seal, holding an unread letter.";

  return (
    <svg
      viewBox="0 0 96 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      /* When decorative: hide from AT entirely */
      aria-hidden={isDecorative || undefined}
      /* When meaningful: provide role + labels */
      role={isDecorative ? undefined : "img"}
      aria-labelledby={isDecorative ? undefined : `${titleId} ${descId}`}
    >
      {!isDecorative && (
        <>
          <title id={titleId}>{titleText}</title>
          <desc id={descId}>{descText}</desc>
        </>
      )}

      {isOpen ? (
        /* ── Open envelope: a letter rising out of an open envelope ──────
           Drawing order matters. The letter card is painted first with a
           solid fill, then the front pocket (a V-notched panel, also solid)
           is painted over the letter's lower half — so the card reads as
           tucked inside and nothing shows through. No shared body rect or
           bottom creases here; those belong to the sealed look and were the
           source of the tangled overlap. */
        <>
          {/* Letter — solid card emerging from the envelope */}
          <rect
            x="24"
            y="6"
            width="48"
            height="46"
            rx="2"
            fill="var(--background)"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          {/* Text lines on the visible upper half of the letter */}
          <line
            x1="32"
            y1="17"
            x2="64"
            y2="17"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />
          <line
            x1="32"
            y1="24"
            x2="64"
            y2="24"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />
          <line
            x1="32"
            y1="31"
            x2="54"
            y2="31"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />

          {/* Front pocket — V-notch top, painted over the letter's lower half.
              Rounded bottom corners echo the sealed body's rx. */}
          <path
            d="M4 30 L48 52 L92 30 L92 73 Q92 76 89 76 L7 76 Q4 76 4 73 Z"
            fill="var(--background)"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </>
      ) : (
        /* ── Sealed envelope: closed body, flap V-fold, and wax seal ───── */
        <>
          {/* Envelope body */}
          <rect
            x="4"
            y="22"
            width="88"
            height="54"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />

          {/* Bottom-left crease */}
          <line
            x1="4"
            y1="76"
            x2="40"
            y2="48"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />

          {/* Bottom-right crease */}
          <line
            x1="92"
            y1="76"
            x2="56"
            y2="48"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />

          {/* Sealed flap — V-fold pointing down toward center */}
          <path
            d="M4 22 L48 52 L92 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Wax-seal — delegated to SealMarkGeometry (single source of truth).
              The geometry is centered at (48, 49) in this viewBox, which is the
              flap-fold intersection point. The animateSeal prop forwards the
              idle pulse class to only the seal group. Omitted when showSeal is
              false so the flap can be stamped by a separate flying seal. */}
          {showSeal && (
            <SealMarkGeometry className={animateSeal ? "animate-wax-pulse" : ""} />
          )}
        </>
      )}
    </svg>
  );
}
