"use client";

import { useEffect, useRef } from "react";
import { dismissConnectionsBadge } from "./actions";

/**
 * Fires once on mount to mark connections as seen (clears the dashboard red dot
 * on the next visit). Renders nothing. Kept as a tiny client component so the
 * cursor update is a server action rather than a mutation during page render.
 */
export function ClearConnectionsBadge() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void dismissConnectionsBadge();
  }, []);
  return null;
}
