"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore } from "lucide-react";
import { restoreKeptLetterAction } from "./actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RestoreKeptLetterButtonProps {
  letterId: string;
  /** Compact icon-only trigger for dense list rows. */
  compact?: boolean;
  /** When provided in compact mode, gives the icon button a distinct accessible name. */
  letterName?: string;
}

/**
 * Restore an archived letter back into the kept list. Non-destructive, so it
 * needs no confirmation — a single click un-archives and refreshes.
 */
export function RestoreKeptLetterButton({
  letterId,
  compact = false,
  letterName,
}: RestoreKeptLetterButtonProps) {
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRestore() {
    setError(false);
    startTransition(async () => {
      try {
        const res = await restoreKeptLetterAction(letterId);
        if (res.status === "restored") {
          router.refresh();
          return;
        }
        setError(true);
      } catch {
        setError(true);
      }
    });
  }

  if (compact) {
    const restoreLabel = letterName
      ? `Restore "${letterName}"`
      : "Restore letter";
    return (
      <>
        <button
          type="button"
          onClick={handleRestore}
          disabled={isPending}
          aria-label={
            error ? `${restoreLabel} — last attempt failed, try again` : restoreLabel
          }
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <ArchiveRestore aria-hidden />
        </button>
        {/* Visually-hidden live region so SR users hear the failure even if
            focus has moved away from the icon button. */}
        <span role="status" aria-live="polite" className="sr-only">
          {error ? "Couldn't restore the letter. Try again." : ""}
        </span>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t restore this letter. Please try again.
        </p>
      )}
      <button
        type="button"
        onClick={handleRestore}
        disabled={isPending}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <ArchiveRestore aria-hidden />
        {isPending ? "Restoring…" : error ? "Try again" : "Restore"}
      </button>
    </div>
  );
}
