"use client";

import React, { useId } from "react";

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
}

/**
 * Envelope — brand SVG illustration for Send a Letter.
 *
 * Uses `currentColor` for ink lines so it inherits text color in any context.
 * The wax-seal circle uses `var(--wax)` directly so it is always terracotta.
 *
 * The wax seal lives in its own `<g data-seal>` group (transform-origin at the
 * seal center). Apply `.animate-seal-break` to that group for the unlock pop,
 * or pass `animateSeal` for the idle breathing pulse on the seal alone. Use
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

      {isOpen ? (
        /* Open flap — rotated up, showing inside of envelope */
        <>
          {/* Flap (open, pointing upward) */}
          <path
            d="M4 22 L48 4 L92 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Inside shadow hint */}
          <path
            d="M4 22 L48 38 L92 22"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
            opacity="0.3"
          />
          {/* Letter peeking out */}
          <rect
            x="22"
            y="16"
            width="52"
            height="30"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            opacity="0.6"
          />
          <line
            x1="30"
            y1="26"
            x2="66"
            y2="26"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />
          <line
            x1="30"
            y1="32"
            x2="58"
            y2="32"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />
        </>
      ) : (
        /* Sealed flap — V-fold pointing down toward center */
        <>
          <path
            d="M4 22 L48 52 L92 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Wax-seal group — independently targetable so animations affect only
              the seal, not the ink line art. transform-origin set to the seal
              center (cx 48, cy 49) so it scales/rotates in place.
                • `.animate-seal-break` (applied by the letter page at unlock)
                  cracks/pops this group.
                • `animateSeal` opts into the idle `.animate-wax-pulse` breathing
                  on this group alone. */}
          <g
            className={animateSeal ? "animate-wax-pulse" : undefined}
            style={{ transformOrigin: "48px 49px", transformBox: "fill-box" }}
            data-seal=""
          >
          {/* Wax seal — terracotta circle at the flap-fold intersection */}
          <circle
            cx="48"
            cy="49"
            r="10"
            fill="var(--wax)"
            stroke="var(--wax)"
            strokeWidth="1"
            opacity="0.95"
          />

          {/* Outer ring impression */}
          <circle
            cx="48"
            cy="49"
            r="7.8"
            fill="none"
            stroke="var(--primary-foreground)"
            strokeWidth="0.9"
            opacity="0.45"
          />

          {/* 6-point rosette — alternating long/short petals radiating from center.
              Each petal: a line from center outward, slightly varied length for texture. */}
          {/* Long spokes at 0°, 60°, 120°, 180°, 240°, 300° */}
          <line x1="48" y1="44.5" x2="48" y2="46.5"   stroke="var(--primary-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
          <line x1="48" y1="51.5" x2="48" y2="53.5"   stroke="var(--primary-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
          <line x1="43.1" y1="46.5" x2="44.8" y2="47.5" stroke="var(--primary-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
          <line x1="51.2" y1="50.5" x2="52.9" y2="51.5" stroke="var(--primary-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
          <line x1="43.1" y1="51.5" x2="44.8" y2="50.5" stroke="var(--primary-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
          <line x1="51.2" y1="47.5" x2="52.9" y2="46.5" stroke="var(--primary-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />

          {/* Center dot — the hub of the rosette */}
          <circle
            cx="48"
            cy="49"
            r="1.4"
            fill="var(--primary-foreground)"
            opacity="0.65"
          />
          </g>
        </>
      )}
    </svg>
  );
}

export default Envelope;
