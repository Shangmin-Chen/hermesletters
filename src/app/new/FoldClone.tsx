"use client";

import { forwardRef, useMemo } from "react";

/**
 * FoldClone — a STATIC, lightweight paper clone of the letter body, sliced into
 * three stacked panels that reassemble the sheet at rest (T4.1a–T4.1d).
 *
 * Why a clone, not the live textarea: a single element cannot fold into thirds
 * (scaleY reads as a window-blind). So on "Fold" the orchestrator snapshots the
 * committed textarea value into this clone, then folds the clone with the Web
 * Animations API.
 *
 * Structure (CRITICAL — do not flatten preserve-3d):
 *   .perspective-fold        ← perspective stage (the orchestrator applies the
 *                              "tuck" translate+scale HERE, never below it)
 *     .fold-stack            ← transform-style: preserve-3d, holds the 3 panels
 *       panel (top)          ← OUTER: does rotateX, preserve-3d, NO clip
 *         .fold-face-front   ← paper + text slice, window cut with clip-path
 *         .fold-face-back    ← blank paper, pre-rotated rotateX(180deg)
 *       panel (middle)       ← STATIC: no rotation, no back face
 *       panel (bottom)       ← OUTER: does rotateX, preserve-3d, NO clip
 *         .fold-face-front
 *         .fold-face-back
 *
 * Each face shows a full-height copy of the text translated up by
 * `index * panelHeight`, then clipped to its own window with `clip-path: inset()`
 * (NOT overflow:hidden, which would force transform-style:flat and collapse the
 * 3-D fold). The three windows together reproduce the full sheet at rest.
 *
 * The orchestrator owns measurement and the WAAPI timeline; this component is
 * presentational. It forwards three refs the orchestrator animates:
 *   • ref            → the perspective stage  (tuck target)
 *   • topPanelRef    → the top panel outer     (fold-top target)
 *   • bottomPanelRef → the bottom panel outer  (fold-bottom target)
 */

export interface FoldCloneProps {
  /** Committed body text (snapshot of the textarea value). */
  text: string;
  /** Measured total content height, in px. */
  totalHeight: number;
  /** Height of one panel = ceil(totalHeight / 3), in px. */
  panelHeight: number;
  /** Rendered width to match the live textarea content box, in px. */
  width: number;
  /** Padding (px) the text copies use, matched to the live paper field. */
  padX: number;
  padY: number;
  /** Forwarded ref to the top panel OUTER (rotateX target). */
  topPanelRef: React.Ref<HTMLDivElement>;
  /** Forwarded ref to the bottom panel OUTER (rotateX target). */
  bottomPanelRef: React.Ref<HTMLDivElement>;
}

/** Shared inline style for a full-height text copy, offset so panel `index`
 *  shows the correct slice of the page. */
function textCopyStyle(
  totalHeight: number,
  index: number,
  panelHeight: number,
  width: number,
  padX: number,
  padY: number
): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height: totalHeight,
    // Pull the full page up so this window lands on its third.
    transform: `translateY(${-index * panelHeight}px)`,
    paddingLeft: padX,
    paddingRight: padX,
    paddingTop: padY,
    paddingBottom: padY,
    boxSizing: "border-box",
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "break-word",
  };
}

/** A single text-window face. The window is cut with clip-path (never
 *  overflow) so a preserve-3d parent keeps its depth. */
function FrontFace({
  text,
  index,
  totalHeight,
  panelHeight,
  width,
  padX,
  padY,
}: {
  text: string;
  index: number;
  totalHeight: number;
  panelHeight: number;
  width: number;
  padX: number;
  padY: number;
}) {
  return (
    <div
      className="fold-face-front absolute inset-0 bg-paper text-ink"
      style={{
        // The last panel may be taller than its text slice (paper slack) — that
        // is fine; we never clip text, only show blank paper below it.
        clipPath: "inset(0 0 0 0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        overflow: "visible",
      }}
    >
      <div
        className="font-serif text-base leading-[1.85] text-ink"
        style={textCopyStyle(totalHeight, index, panelHeight, width, padX, padY)}
        aria-hidden="true"
      >
        {text}
      </div>
    </div>
  );
}

/** Blank paper back face, pre-rotated so the back of a folded panel reads as
 *  plain paper (no mirrored text) at any fold angle. */
function BackFace() {
  return (
    <div
      className="fold-face-back absolute inset-0 bg-paper"
      style={{
        transform: "rotateX(180deg)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
      aria-hidden="true"
    />
  );
}

export const FoldClone = forwardRef<HTMLDivElement, FoldCloneProps>(
  function FoldClone(
    {
      text,
      totalHeight,
      panelHeight,
      width,
      padX,
      padY,
      topPanelRef,
      bottomPanelRef,
    },
    stageRef
  ) {
    // A panel's outer box is a fixed-height window onto the page.
    const panelStyle = useMemo<React.CSSProperties>(
      () => ({
        position: "relative",
        width,
        height: panelHeight,
        transformStyle: "preserve-3d",
      }),
      [width, panelHeight]
    );

    return (
      // Perspective STAGE. The orchestrator applies the tuck (translate+scale)
      // to THIS node so depth is preserved (never to a preserve-3d child).
      <div
        ref={stageRef}
        className="perspective-fold pointer-events-none select-none"
        style={{ width }}
        aria-hidden="true"
      >
        <div
          className="fold-stack relative mx-auto rounded-sm shadow-sm"
          style={{ width, height: panelHeight * 3 }}
        >
          {/* TOP panel — hinged at its BOTTOM edge, folds down. */}
          <div
            ref={topPanelRef}
            style={{ ...panelStyle, transformOrigin: "center bottom" }}
          >
            <FrontFace
              text={text}
              index={0}
              totalHeight={totalHeight}
              panelHeight={panelHeight}
              width={width}
              padX={padX}
              padY={padY}
            />
            <BackFace />
          </div>

          {/* MIDDLE panel — static. No rotation, no back face. */}
          <div style={panelStyle}>
            <FrontFace
              text={text}
              index={1}
              totalHeight={totalHeight}
              panelHeight={panelHeight}
              width={width}
              padX={padX}
              padY={padY}
            />
          </div>

          {/* BOTTOM panel — hinged at its TOP edge, folds up. */}
          <div
            ref={bottomPanelRef}
            style={{ ...panelStyle, transformOrigin: "center top" }}
          >
            <FrontFace
              text={text}
              index={2}
              totalHeight={totalHeight}
              panelHeight={panelHeight}
              width={width}
              padX={padX}
              padY={padY}
            />
            <BackFace />
          </div>

          {/* Crease shadows on a NON-rotating overlay above the stack (so they
              don't rotate with a panel). Two faint gradients mark the folds. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, transparent 0, color-mix(in oklch, var(--ink), transparent 88%) calc(33.333% - 1px), transparent calc(33.333% + 1px), transparent calc(66.666% - 1px), color-mix(in oklch, var(--ink), transparent 88%) calc(66.666% + 1px), transparent 100%)",
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }
);
