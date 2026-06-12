"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

function format(d: Date, timeZone?: string): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });
}

/**
 * Renders a timestamp in the reader's own timezone.
 *
 * Server-rendered output uses UTC (stable across server regions); after
 * hydration it re-renders in the visitor's local timezone. Wrapped in <time>
 * with a machine-readable dateTime for accessibility.
 */
export function LocalDateTime({ date }: { date: Date | string }) {
  const d = new Date(date);
  // false during SSR and the hydration render, true after — lets us render a
  // stable UTC string on the server and the visitor's local time in the browser.
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const text = isClient ? format(d) : format(d, "UTC");

  return (
    <time dateTime={d.toISOString()} suppressHydrationWarning>
      {text}
    </time>
  );
}
