import React from "react";
import { Envelope } from "./Envelope";

export interface WordmarkProps {
  /** Size variant — controls overall scale */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** When set, renders the wordmark as an anchor pointing here (e.g. "/" for a
   *  home link). When omitted, renders a non-interactive <span> as before. */
  href?: string;
}

const sizeMap = {
  sm: { icon: "w-5 h-5",  text: "text-base",  gap: "gap-2"  },
  md: { icon: "w-7 h-7",  text: "text-xl",    gap: "gap-2.5" },
  lg: { icon: "w-10 h-10", text: "text-3xl",  gap: "gap-3"  },
};

/**
 * Wordmark — "Hermes' Letters" logotype lockup.
 *
 * Combines the Envelope mark with the product name.
 * Inherits text color so it works on any background; the wax seal in the
 * Envelope component renders in `var(--wax)` — a muted sealing-wax red, the one
 * saturated accent against the otherwise paper-and-ink (achromatic) palette.
 *
 * @example
 *   <Wordmark />                        // default md, inherits color
 *   <Wordmark size="lg" />              // large header lockup
 *   <Wordmark className="text-ink" />   // explicit ink color
 *   <Wordmark href="/" />               // renders as a home link
 */
export function Wordmark({ size = "md", className = "", href }: WordmarkProps) {
  const s = sizeMap[size];
  const Tag = href ? "a" : "span";

  return (
    <Tag
      {...(href ? { href } : {})}
      className={`inline-flex items-center ${s.gap} ${className}`}
      aria-label="Hermes Letters"
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
        Hermes Letters
      </span>
    </Tag>
  );
}
