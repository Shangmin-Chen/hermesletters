"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { archiveKeptLetterAction } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ArchiveKeptLetterButtonProps {
  letterId: string;
  /** Detail page → redirect to the dashboard after archiving; list → refresh in place. */
  redirectOnDone?: boolean;
  /** Compact icon-only trigger for dense list rows. */
  compact?: boolean;
}

/**
 * Archive a kept letter behind a confirmation warning. Archiving is reversible
 * (it only hides the letter from the kept list), but it removes the letter from
 * view, so it requires an explicit confirm.
 */
export function ArchiveKeptLetterButton({
  letterId,
  redirectOnDone = false,
  compact = false,
}: ArchiveKeptLetterButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      const res = await archiveKeptLetterAction(letterId);
      if (res.status === "archived") {
        setOpen(false);
        if (redirectOnDone) router.push("/dashboard");
        else router.refresh();
        return;
      }
      setError("Couldn't archive this letter. Please try again.");
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger
        className={cn(
          compact
            ? buttonVariants({ variant: "ghost", size: "icon-sm" })
            : buttonVariants({ variant: "outline", size: "sm" })
        )}
        aria-label={compact ? "Archive letter" : undefined}
      >
        <Archive aria-hidden />
        {!compact && "Archive"}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogTitle>Archive this letter?</AlertDialogTitle>
        <AlertDialogDescription>
          It leaves your kept list, but it isn&apos;t deleted — you can restore it
          anytime from your archive.
        </AlertDialogDescription>

        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogClose
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            disabled={isPending}
          >
            Cancel
          </AlertDialogClose>
          <Button
            type="button"
            size="sm"
            onClick={handleArchive}
            disabled={isPending}
          >
            {isPending ? "Archiving…" : "Archive"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
