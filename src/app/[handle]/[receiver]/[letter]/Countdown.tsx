"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Live countdown toward an expiry instant, shown alongside the absolute time.
 *
 * Renders an approximate, human-readable remaining duration ("about 23 hours
 * left") that updates roughly each minute so the 24h burn window feels urgent
 * without flashing. Respects prefers-reduced-motion by not narrowing the update
 * cadence (the interval is already gentle, so there's nothing to dampen beyond
 * avoiding sub-minute churn).
 *
 * SSR-safe: renders nothing until mounted so server and client agree (the
 * absolute <LocalDateTime> already carries the canonical time).
 */
export function Countdown({ expiresAt }: { expiresAt: Date | string }) {
  const target = new Date(expiresAt).getTime();
  // false during SSR and the hydration render, true after — lets us render
  // nothing on the server (avoiding a hydration mismatch) and the live
  // countdown only once we're safely on the client.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  // Lazily seeded on the client's first render; kept fresh by the interval.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Update each minute normally; for reduced-motion keep it slower still.
    const intervalMs = reduceMotion ? 5 * 60_000 : 60_000;
    // setState lives in the interval callback (not the effect body), so it
    // tracks the external clock without triggering cascading renders.
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, []);

  // Pre-mount (and during SSR): render nothing to avoid hydration mismatch.
  if (!mounted) return null;

  const remainingMs = target - now;

  if (remainingMs <= 0) {
    return <span className="text-wax font-medium">expiring now</span>;
  }

  return (
    <span className="text-foreground font-medium">{formatRemaining(remainingMs)}</span>
  );
}

/**
 * Human-friendly "about N units left", coarsened so it doesn't twitch:
 *   > 1h   → hours
 *   1–60m  → minutes
 *   < 1m   → "less than a minute left"
 */
function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);

  if (totalMinutes < 1) {
    return "less than a minute left";
  }

  if (totalMinutes < 60) {
    return `about ${totalMinutes} minute${totalMinutes === 1 ? "" : "s"} left`;
  }

  // Round to nearest hour for a calm, approximate signal.
  const hours = Math.round(totalMinutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"} left`;
}
