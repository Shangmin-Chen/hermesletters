"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLongPress, usePress } from "@react-aria/interactions";
import { mergeProps } from "@react-aria/utils";
import { Envelope } from "@/components/brand/Envelope";
import { SealMark } from "@/components/brand/SealMark";

// How long (ms) the recipient must hold to unseal the letter.
const UNSEAL_HOLD_MS = 750;

// Geometry — mirrors WaxSeal's resting-seal constants.
const REST_SEAL = 48; // px — interactive seal diameter on the flap
const RING_BOX = 60; // px — charging-ring viewport
const RING_R = 27;   // ring radius within the box
const RING_C = 2 * Math.PI * RING_R; // circumference for dash math

interface WaxUnsealProps {
  /**
   * Called once the hold gesture completes and the unseal animation finishes.
   * The caller should fire the POST to /api/letters/[id]/verify here.
   */
  onUnseal: () => void;
  /** When true the gesture and animation are disabled (e.g. while the POST is in flight). */
  disabled?: boolean;
}

/**
 * WaxUnseal — the recipient-side reverse of the sender's WaxSeal.
 *
 * Shows a sealed envelope with the wax seal on the flap. The recipient presses
 * and holds the seal; a charging ring fills around it. On commit:
 *   1. The seal cracks and lifts off (animate-seal-break — already in globals.css).
 *   2. The flap swings open (animate-flap-open — already in globals.css).
 *   3. `onUnseal()` fires so the caller can POST the unlock route.
 *
 * Dual-path gesture (WCAG 2.5.1 — Pointer Gestures):
 *   • useLongPress  → hold UNSEAL_HOLD_MS ms to commit
 *   • usePress.onPress → keyboard Enter/Space or virtual activate commits instantly
 *
 * Respects prefers-reduced-motion: commits instantly with no animation when set.
 */
export function WaxUnseal({ onUnseal, disabled = false }: WaxUnsealProps) {
  const [progress, setProgress] = useState(0);     // 0–1 while held
  const [pressing, setPressing] = useState(false);  // true while pointer is down
  const [unsealing, setUnsealing] = useState(false); // animation playing

  const pressStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const committingRef = useRef(false);

  const prefersReduced =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // Tick progress while held — drives charging ring + scale/glow feedback.
  const startProgress = useCallback(() => {
    if (disabled || unsealing) return;
    pressStartRef.current = performance.now();
    setPressing(true);

    if (prefersReduced) {
      setProgress(1);
      return;
    }

    const tick = () => {
      if (pressStartRef.current === null) return;
      const elapsed = performance.now() - pressStartRef.current;
      const p = Math.min(elapsed / UNSEAL_HOLD_MS, 1);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, unsealing, prefersReduced]);

  const cancelProgress = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pressStartRef.current = null;
    setPressing(false);
    if (!unsealing) setProgress(0);
  }, [unsealing]);

  const commitUnseal = useCallback(() => {
    if (disabled || unsealing || committingRef.current) return;
    committingRef.current = true;
    cancelProgress();
    setProgress(1);

    // Reduced motion: skip animation, fire callback instantly.
    if (prefersReduced) {
      committingRef.current = false;
      onUnseal();
      return;
    }

    // Play the crack + flap-open sequence. The CSS keyframes in globals.css
    // are gated on [data-unsealing="playing"] (new selectors appended below).
    // The envelope + seal animation lasts ~550ms; we fire onUnseal right after.
    setUnsealing(true);
    setTimeout(() => {
      committingRef.current = false;
      onUnseal();
    }, 600);
  }, [disabled, unsealing, prefersReduced, cancelProgress, onUnseal]);

  const { longPressProps } = useLongPress({
    threshold: UNSEAL_HOLD_MS,
    accessibilityDescription: "Press and hold to unseal the letter",
    onLongPress: commitUnseal,
    onLongPressEnd() {
      if (!unsealing && !committingRef.current) cancelProgress();
    },
  });

  const { pressProps } = usePress({
    isDisabled: disabled || unsealing,
    onPressStart() {
      startProgress();
    },
    onPressEnd() {
      if (!unsealing && !committingRef.current) cancelProgress();
    },
    onPress(e) {
      if (e.pointerType === "keyboard" || e.pointerType === "virtual" || prefersReduced) {
        commitUnseal();
      }
    },
  });

  // Clean up rAF on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Resting-seal visual state: scales up + glows as the hold progresses.
  const sealScale = pressing ? 1 + progress * 0.18 : 1;
  const sealOpacity = pressing ? 0.6 + progress * 0.4 : 1;
  const glow = pressing ? progress : 0;

  return (
    <div
      className="flex flex-col items-center gap-6"
      data-unsealing={unsealing ? "playing" : "idle"}
    >
      {/* Sealed envelope — the wax seal on the flap is the press target */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* The envelope itself — flap swings open when unsealing */}
        <div className="unseal-flap" style={{ perspective: "600px" }}>
          <Envelope
            state="sealed"
            showSeal={false}
            className="w-32 h-32 text-ink drop-shadow-[0_6px_16px_oklch(0_0_0/0.14)]"
            aria-hidden
          />
        </div>

        {/* The wax seal resting on the flap — cracks and lifts off on commit */}
        <div
          className="unseal-seal absolute"
          style={{
            left: "50%",
            top: "59%",
            transform: "translate(-50%, -50%)",
            width: REST_SEAL,
            height: REST_SEAL,
          }}
        >
          {/* Charging-ring viewport — centered around the seal */}
          <div
            className="relative"
            style={{ width: RING_BOX, height: RING_BOX, margin: "auto", transform: "translate(-6px, -6px)" }}
          >
            {/* Charging ring — track + progress arc */}
            <svg
              className="absolute inset-0 -rotate-90"
              viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
              aria-hidden
            >
              <circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_R}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2}
              />
              <circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_R}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - progress)}
                style={{
                  transition:
                    pressing || prefersReduced
                      ? "none"
                      : "stroke-dashoffset 0.3s ease",
                  opacity: progress > 0 ? 1 : 0,
                }}
              />
            </svg>

            {/* The seal itself — press + hold target */}
            <button
              {...mergeProps(longPressProps, pressProps)}
              type="button"
              aria-label="Press and hold to unseal the letter"
              disabled={disabled || unsealing}
              aria-disabled={disabled || unsealing}
              className={[
                "absolute left-1/2 top-1/2",
                "select-none rounded-full",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-offset-2",
                disabled || unsealing
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer",
              ].join(" ")}
              style={
                !prefersReduced
                  ? {
                      transform: `translate(-50%, -50%) scale(${sealScale})`,
                      opacity: sealOpacity,
                      filter: glow
                        ? `drop-shadow(0 ${2 + glow * 5}px ${6 + glow * 14}px oklch(0 0 0 / ${0.12 + glow * 0.28}))`
                        : undefined,
                      transition: pressing
                        ? "none"
                        : "transform 0.25s ease, opacity 0.25s ease, filter 0.25s ease",
                    }
                  : { transform: "translate(-50%, -50%)" }
              }
            >
              <SealMark
                size={REST_SEAL}
                tight
                groupClassName={
                  !disabled && !pressing && !unsealing && !prefersReduced
                    ? "animate-wax-pulse"
                    : ""
                }
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>

      {/* Status label */}
      <p
        className="w-56 text-sm text-center text-muted-foreground min-h-[1.25rem]"
        aria-live="polite"
      >
        {unsealing
          ? "Opening…"
          : disabled
            ? "Opening…"
            : progress > 0 && progress < 1
              ? "Keep holding…"
              : "Press and hold to open"}
      </p>
    </div>
  );
}
