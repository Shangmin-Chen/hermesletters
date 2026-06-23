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
}

/**
 * Restore an archived letter back into the kept list. Non-destructive, so it
 * needs no confirmation — a single click un-archives and refreshes.
 */
export function RestoreKeptLetterButton({
  letterId,
  compact = false,
}: RestoreKeptLetterButtonProps) {
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRestore() {
    setError(false);
    startTransition(async () => {
      const res = await restoreKeptLetterAction(letterId);
      if (res.status === "restored") {
        router.refresh();
        return;
      }
      setError(true);
    });
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={isPending}
      aria-label={compact ? "Restore letter" : undefined}
      className={cn(
        compact
          ? buttonVariants({ variant: "ghost", size: "icon-sm" })
          : buttonVariants({ variant: "outline", size: "sm" })
      )}
    >
      <ArchiveRestore aria-hidden />
      {!compact && (isPending ? "Restoring…" : error ? "Try again" : "Restore")}
    </button>
  );
}
