"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WaxUnseal } from "@/components/letter/WaxUnseal";
import { openDirectLetterAction } from "../actions";

/**
 * Recipient-side unseal for a DIRECT letter. Reuses the wax-unseal ceremony, but
 * the open is an authenticated server action (no claim cookie). On success the
 * server flips status → 'opened' and we refresh to render the content.
 */
export function InboxLockedView({
  letterId,
  senderHandle,
}: {
  letterId: string;
  senderHandle: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const router = useRouter();

  function handleUnseal() {
    startTransition(async () => {
      try {
        // Both "opened" (we flipped it) and "noop" (a concurrent open won) mean
        // the letter is now open — refresh to render it.
        await openDirectLetterAction(letterId);
        router.refresh();
      } catch {
        setResetKey((k) => k + 1);
        setErrorMsg("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center animate-rise-in">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-semibold leading-snug tracking-tight text-foreground">
            You have a letter.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            from{" "}
            <span className="font-mono text-foreground/80">@{senderHandle}</span>
          </p>
        </div>

        <WaxUnseal
          onUnseal={handleUnseal}
          disabled={isPending}
          resetKey={resetKey}
        />

        {errorMsg && (
          <p role="alert" className="mt-5 text-center text-sm text-destructive">
            {errorMsg}
          </p>
        )}
      </div>
    </main>
  );
}
