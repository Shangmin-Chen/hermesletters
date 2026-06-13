"use client";

import { useRef } from "react";

/**
 * Two-step sign-out: first click arms it, second click submits.
 * Keeps the form action POST to /auth/signout working.
 * Touch target is ≥44px via explicit min-h/min-w.
 */
export function SignOutButton() {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRef = useRef(false);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!armedRef.current) {
      // First click — arm the button, auto-disarm after 3 s
      e.preventDefault();
      armedRef.current = true;
      // Force re-render via the button's data attribute (no extra state hook needed)
      const btn = e.currentTarget;
      btn.dataset.armed = "true";
      btn.textContent = "Tap again to sign out";
      timerRef.current = setTimeout(() => {
        armedRef.current = false;
        btn.dataset.armed = "false";
        btn.textContent = "Sign out";
        if (timerRef.current) clearTimeout(timerRef.current);
      }, 3000);
    }
    // Second click — falls through, form submits naturally
  }

  return (
    <form ref={formRef} action="/auth/signout" method="POST">
      <button
        type="submit"
        onClick={handleClick}
        data-armed="false"
        className={[
          // Touch target ≥44px
          "min-h-[44px] min-w-[44px] px-3",
          "text-xs text-muted-foreground hover:text-foreground",
          "rounded-md transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "data-[armed=true]:text-wax data-[armed=true]:font-medium",
        ].join(" ")}
      >
        Sign out
      </button>
    </form>
  );
}
