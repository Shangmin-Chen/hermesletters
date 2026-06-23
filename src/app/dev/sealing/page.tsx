"use client";

import { useState, useCallback } from "react";
import { WaxSeal } from "@/app/(chrome)/new/new-letter-form";
import { DevBack } from "../DevBack";

/**
 * Dev fixture: the compose-side WaxSeal standalone, with a replay control.
 *
 * This is the sender's seal ritual — the seal rests on the flap and presses
 * straight down (squash + impact ripple) when the hold completes, then onSeal
 * fires. It's the symmetric counterpart to /dev/unsealing (the recipient's
 * WaxUnseal). Once sealed, the built-in "Break seal to edit" affordance resets
 * it; the top-right Replay remounts the component to clear all internal state.
 */
export default function DevSealing() {
  const [key, setKey] = useState(0);
  const [sealed, setSealed] = useState(false);

  const handleSeal = useCallback(() => {
    setSealed(true);
  }, []);

  const handleBreakSeal = useCallback(() => {
    setSealed(false);
  }, []);

  const handleReplay = useCallback(() => {
    setSealed(false);
    // Increment key to remount WaxSeal and reset all internal animation state.
    setKey((k) => k + 1);
  }, []);

  return (
    <>
      <DevBack />

      {/* Replay control — mirrors DevRevealReplay's style */}
      <button
        type="button"
        onClick={handleReplay}
        className="fixed right-4 top-4 z-50 rounded-full border border-wax/50 bg-card/80 px-3 py-1.5 text-xs font-medium text-wax shadow-sm backdrop-blur transition-colors hover:bg-wax hover:text-wax-foreground"
      >
        ▶ Replay stamp
      </button>

      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-8">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground leading-snug tracking-tight">
              Wax-seal stamp
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Press and hold the seal to stamp it down.
            </p>
          </div>

          <WaxSeal
            key={key}
            disabled={false}
            sealed={sealed}
            onSeal={handleSeal}
            onBreakSeal={handleBreakSeal}
          />

          {sealed && (
            <p className="text-sm text-wax font-medium animate-rise-in">
              Sealed — onSeal fired.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
