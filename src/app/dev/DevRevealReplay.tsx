"use client";

/**
 * Re-arms the one-shot reveal: RevealOnce plays its envelope-chrome animation
 * only when `sessionStorage["just-opened:<id>"]` is set (and then clears it).
 * In the real app that flag is set by the unlock handler on unseal; here we set it and
 * reload so the reveal can be QA'd on demand.
 */
export function DevRevealReplay({ letterId }: { letterId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          sessionStorage.setItem(`just-opened:${letterId}`, "1");
        } catch {
          // ignore
        }
        location.reload();
      }}
      className="fixed right-4 top-4 z-50 rounded-full border border-wax/50 bg-card/80 px-3 py-1.5 text-xs font-medium text-wax shadow-sm backdrop-blur transition-colors hover:bg-wax hover:text-wax-foreground"
    >
      ▶ Replay reveal
    </button>
  );
}
