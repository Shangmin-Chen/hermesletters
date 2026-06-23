"use client";

import React from "react";

// ── SealMarkGeometry ─────────────────────────────────────────────────────────
//
// The raw <g data-seal> SVG geometry for the brand wax seal — the rosette,
// outer ring impression, wax disc, and center hub. This fragment is designed
// to be embedded inside ANY <svg> viewBox that uses the same coordinate space
// (see `cx` / `cy` below).
//
// Both SealMark (standalone large SVG) and Envelope (small inline seal) import
// this to guarantee a single source of truth for the artwork.
//
// Coordinate space: all geometry is centered at (48, 49) in a 96×80+ viewBox.
// For a standalone square SVG (SealMark), a translate(0, -1) normalizes the
// center to (48, 48).
//
// Colors: `var(--wax)` (muted sealing-wax red) for the disc, and
//         `var(--wax-foreground)` (a light wax-highlight) for the impressed
//         ring / rosette / hub so the stamp stays legible on the red wax.

export interface SealMarkGeometryProps {
  /** Extra class names on the <g data-seal> group. Use for animation classes
   *  like `animate-wax-pulse`. The transform-origin is always the seal center
   *  so scale animations land correctly. */
  className?: string;
}

/**
 * SVG <g> fragment — the wax seal artwork with no enclosing <svg> element.
 * Embed this inside any <svg> that shares the (48, 49) coordinate space.
 *
 * The group carries `data-seal=""` so CSS selectors targeting `[data-seal]`
 * (e.g. `.animate-seal-break`) continue to work.
 */
export function SealMarkGeometry({ className = "" }: SealMarkGeometryProps) {
  return (
    <g
      className={className || undefined}
      /* transformBox: fill-box resolves transform-origin against this group's
         OWN bounding box, so the anchor must be `center` (the seal's middle),
         not the absolute user-space point 48/49 — that length would land far
         outside the ~20px bbox and make scale animations drift to the top-left. */
      style={{ transformOrigin: "center", transformBox: "fill-box" }}
      data-seal=""
    >
      {/* Wax disc — primary-colour circle (zero-chroma greyscale in paper-and-ink theme) */}
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
        stroke="var(--wax-foreground)"
        strokeWidth="0.9"
        opacity="0.45"
      />

      {/* 6-point rosette — long spokes at 0°, 60°, 120°, 180°, 240°, 300° */}
      <line x1="48" y1="44.5" x2="48" y2="46.5"
        stroke="var(--wax-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <line x1="48" y1="51.5" x2="48" y2="53.5"
        stroke="var(--wax-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <line x1="43.1" y1="46.5" x2="44.8" y2="47.5"
        stroke="var(--wax-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <line x1="51.2" y1="50.5" x2="52.9" y2="51.5"
        stroke="var(--wax-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <line x1="43.1" y1="51.5" x2="44.8" y2="50.5"
        stroke="var(--wax-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <line x1="51.2" y1="47.5" x2="52.9" y2="46.5"
        stroke="var(--wax-foreground)" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />

      {/* Center hub dot */}
      <circle
        cx="48"
        cy="49"
        r="1.4"
        fill="var(--wax-foreground)"
        opacity="0.65"
      />
    </g>
  );
}

// ── SealMark ─────────────────────────────────────────────────────────────────
//
// Standalone wax-seal SVG. The viewBox is 96×96 (square) with the geometry
// centered at (48, 48) after a translate(0, -1) correction (the Envelope
// coordinate space uses cy=49 to sit at the flap fold; here we center it).
//
// Primary use: the large interactive seal in the "Seal your letter" step, where
// `size` can be ~120px and animation classes like `animate-wax-pulse` are needed.
//
// For small decorative seals embedded inside an <svg> (e.g. Envelope), use
// `<SealMarkGeometry>` directly instead.

export interface SealMarkProps {
  /** Rendered pixel width (and height — always square). Default 96. */
  size?: number;
  /** Additional class names on the outer <svg>. E.g. `animate-wax-pulse`. */
  className?: string;
  /** Extra class names on the inner <g data-seal> group only. */
  groupClassName?: string;
  /** Set true (default) when purely decorative. */
  "aria-hidden"?: boolean;
  /** Title text when NOT decorative. */
  title?: string;
  /** When true, the viewBox is cropped tightly to the seal artwork so `size`
   *  ≈ the seal's visible diameter (instead of the artwork floating in a box
   *  ~4.5× larger). Use when something needs to sit flush against the seal —
   *  e.g. a charging ring. Default false keeps every existing call site at its
   *  current scale. */
  tight?: boolean;
}

/**
 * Standalone wax-seal SVG component — wraps `<SealMarkGeometry>` in a square
 * SVG viewBox so it can be rendered as an independent image at any size.
 *
 * @example
 *   // Idle pulse on the large interactive seal
 *   <SealMark size={120} groupClassName="animate-wax-pulse" aria-hidden />
 *
 *   // Decorative small seal
 *   <SealMark size={20} aria-hidden />
 */
export function SealMark({
  size = 96,
  className = "",
  groupClassName = "",
  "aria-hidden": ariaHidden = true,
  title,
  tight = false,
}: SealMarkProps) {
  // The artwork is centered at (48, 48) (after the translate below) with a
  // radius of ~10.5. A 24-unit window around it crops the empty padding so the
  // seal fills `size`; the default 96-unit box keeps the original scale.
  const viewBox = tight ? "36 36 24 24" : "0 0 96 96";
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden || undefined}
      role={ariaHidden ? undefined : "img"}
      overflow="visible"
    >
      {!ariaHidden && title && <title>{title}</title>}

      {/* Translate -1 vertically to center the geometry (Envelope uses cy=49;
          here we want it centered in a square viewBox at y=48). */}
      <g transform="translate(0,-1)">
        <SealMarkGeometry className={groupClassName} />
      </g>
    </svg>
  );
}
