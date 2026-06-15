"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// An empty subscribe: only used to obtain the server-vs-client snapshot
// distinction. No actual external store subscription is needed.
const emptySubscribe = () => () => {};

// A real subscribe + snapshot pair for isDark, wired to a custom
// "theme-change" event dispatched by the toggle handler so React re-renders
// when the class flips.
function subscribeTheme(callback: () => void) {
  window.addEventListener("theme-change", callback);
  return () => window.removeEventListener("theme-change", callback);
}
function getIsDark() {
  return document.documentElement.classList.contains("dark");
}

/**
 * ThemeToggle — sun/moon button that flips between light and dark mode.
 *
 * Pairs with the no-flash inline script in the root layout which applies
 * the `.dark` class before first paint based on localStorage / OS pref.
 *
 * Hydration safety: the `mounted` flag from `useSyncExternalStore` is `false`
 * on both the server render AND the first client/hydration render (via the
 * server snapshot `() => false`), so both passes produce byte-identical HTML —
 * an inert ghost placeholder with the same `w-8 px-0 ghost/sm` dimensions as
 * the real button (zero layout shift). Only after hydration does `mounted`
 * become `true` and the real interactive button — with the correct icon —
 * is rendered.
 */
export function ThemeToggle() {
  // false on server + hydration render, true after mount.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Tracks the live `dark` class; re-renders whenever `theme-change` fires.
  // The server snapshot (`false`) is never used in practice because we only
  // read `isDark` in the `mounted` branch below.
  const isDark = useSyncExternalStore(subscribeTheme, getIsDark, () => false);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    // Notify useSyncExternalStore subscribers so the icon re-renders.
    window.dispatchEvent(new Event("theme-change"));
  }, []);

  // Pre-mount (server + hydration): render an inert placeholder with identical
  // box sizing so there is zero layout shift when the real button appears.
  if (!mounted) {
    return (
      <span
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-8 px-0 opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "w-8 px-0 text-muted-foreground hover:text-foreground"
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
