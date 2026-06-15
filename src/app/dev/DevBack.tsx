import Link from "next/link";

/** Fixed "back to the harness index" link shown on every harness sub-route. */
export function DevBack() {
  return (
    <Link
      href="/dev"
      className="fixed left-4 top-4 z-50 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-ink"
    >
      ← harness
    </Link>
  );
}
