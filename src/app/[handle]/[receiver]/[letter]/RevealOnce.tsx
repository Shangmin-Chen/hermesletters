"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealOnceProps {
  /** Stable letter id — keys the one-shot sessionStorage flag set by AnswerInput. */
  letterId: string;
  /**
   * The envelope CHROME (open-envelope header: seal-break → flap-open beats).
   * This is the ONLY thing RevealOnce animates. It is server-rendered JSX
   * handed down as a ReactNode — RevealOnce never builds or re-fetches it.
   */
  chrome: ReactNode;
  /**
   * The already-server-rendered letter: body + gallery + expiry footer + all
   * three keep-flow branches. SECURITY/SSR: this is React `children`, never a
   * `body` string prop RevealOnce re-renders. The body stays server-rendered
   * and readable from frame one; RevealOnce only toggles a class on the chrome.
   */
  children: ReactNode;
}

/**
 * RevealOnce — plays a brief envelope-chrome reveal exactly once, on the open
 * that just happened, then never again.
 *
 * How the one-shot works (SSR + React StrictMode safe):
 *  - Initial state is the NO-ANIMATION state. The server has no sessionStorage,
 *    so render must never read it; reading during render would also mismatch
 *    hydration. We therefore start at `animating === false` and only *upgrade*
 *    to animating inside an effect.
 *  - The flag is read AND cleared inside `useEffect`. To survive StrictMode's
 *    dev double-invoke of effects (which would otherwise let the first pass
 *    clear the flag and the second pass see nothing), we capture the flag into
 *    a `useRef` on the FIRST effect run and clear sessionStorage immediately;
 *    subsequent invocations read the ref, not storage.
 *  - Reduced motion can't be stopped by a CSS @media query for a JS-driven
 *    reveal, so we ALSO consult `matchMedia('(prefers-reduced-motion: reduce)')`
 *    in JS and skip animating when reduced.
 *  - Any tap / scroll / keypress while animating skips straight to the final
 *    state.
 */
export function RevealOnce({ letterId, chrome, children }: RevealOnceProps) {
  // Start in the final (no-animation) state so SSR and the first client render
  // agree. We upgrade to `true` from the effect below if the flag was present.
  const [animating, setAnimating] = useState(false);

  // Captures the one-shot decision on the first effect run, so StrictMode's
  // double-invoke (and any later re-runs) can't re-read/swallow the flag.
  // undefined → not yet decided; boolean → decided this mount.
  const decidedRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    // Decide exactly once per mount. On the StrictMode second invoke, the flag
    // is already cleared from storage but the ref still holds our decision.
    if (decidedRef.current === undefined) {
      const key = `just-opened:${letterId}`;
      let justOpened = false;
      try {
        justOpened = sessionStorage.getItem(key) === "1";
        // Clear immediately so a reload within the grace window shows instantly.
        if (justOpened) sessionStorage.removeItem(key);
      } catch {
        // Storage unavailable → treat as "no animation" (final state).
        justOpened = false;
      }

      // JS reduced-motion gate (a CSS media query cannot stop a JS reveal).
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

      decidedRef.current = justOpened && !reduceMotion;
    }

    if (!decidedRef.current) return;

    // Flag was set AND motion is allowed → play the brief chrome reveal.
    setAnimating(true);

    // Hard cap: end the reveal after the CSS beats finish (≤ ~800ms). Using a
    // timer only to *remove* the animating class is safe — it doesn't gate any
    // body rendering (the body is server-rendered and always at opacity 1).
    const REVEAL_MS = 800;
    const endTimer = window.setTimeout(() => setAnimating(false), REVEAL_MS);

    // Skip-to-final on any user intent.
    const skip = () => setAnimating(false);
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("scroll", skip, { once: true, passive: true });

    return () => {
      window.clearTimeout(endTimer);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("scroll", skip);
    };
    // letterId is stable for the mount; effect runs once per mount.
  }, [letterId]);

  return (
    <>
      {/*
        The chrome wrapper is the ONLY animated element. `data-reveal` flips the
        seal-break/flap-open beats on (animating) or renders the open envelope at
        rest (final). The body/gallery/footer below are untouched server output.
      */}
      <div data-reveal={animating ? "playing" : "done"}>{chrome}</div>
      {children}
    </>
  );
}
