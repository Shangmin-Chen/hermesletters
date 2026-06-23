"use client";

import { useState, useCallback } from "react";
import { WaxUnseal } from "@/components/letter/WaxUnseal";
import { DevBack } from "../DevBack";

/**
 * Dev fixture: WaxUnseal standalone with a replay control.
 *
 * The gesture fires onUnseal after the hold completes; a "Replay" button
 * resets the component so the crack + flap-open sequence can be QA'd again.
 */
export default function DevUnsealing() {
  const [key, setKey] = useState(0);
  const [unsealed, setUnsealed] = useState(false);

  const handleUnseal = useCallback(() => {
    setUnsealed(true);
  }, []);

  const handleReplay = useCallback(() => {
    setUnsealed(false);
    // Increment key to remount WaxUnseal and reset all internal animation state.
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
        ▶ Replay break
      </button>

      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-8">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground leading-snug tracking-tight">
              Wax-unseal gesture
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Press and hold the seal to break it open.
            </p>
          </div>

          <WaxUnseal key={key} onUnseal={handleUnseal} />

          {unsealed && (
            <p className="text-sm text-wax font-medium animate-rise-in">
              Unsealed — onUnseal fired.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
