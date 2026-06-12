import React from "react";
import { Envelope } from "./Envelope";

export interface WordmarkProps {
  /** Size variant — controls overall scale */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { icon: "w-5 h-5",  text: "text-base",  gap: "gap-2"  },
  md: { icon: "w-7 h-7",  text: "text-xl",    gap: "gap-2.5" },
  lg: { icon: "w-10 h-10", text: "text-3xl",  gap: "gap-3"  },
};

/**
 * Wordmark — "Send a Letter" logotype lockup.
 *
 * Combines the Envelope mark with the product name set in Fraunces (serif).
 * Inherits text color so it works on any background; the wax seal in the
 * Envelope component always renders in `var(--wax)`.
 *
 * @example
 *   <Wordmark />                        // default md, inherits color
 *   <Wordmark size="lg" />              // large header lockup
 *   <Wordmark className="text-ink" />   // explicit ink color
 */
export function Wordmark({ size = "md", className = "" }: WordmarkProps) {
  const s = sizeMap[size];

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${className}`}
      aria-label="Send a Letter"
    >
      <Envelope
        state="sealed"
        className={`${s.icon} shrink-0`}
        aria-hidden={true}
      />
      <span
        className={`font-serif font-semibold leading-none tracking-tight ${s.text}`}
        aria-hidden="true"
      >
        Send a Letter
      </span>
    </span>
  );
}

export default Wordmark;
