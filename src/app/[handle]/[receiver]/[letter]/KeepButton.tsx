"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KeepButtonProps {
  letterId: string;
  /** Full path of this letter page, e.g. "/handle/receiver/letter" */
  letterPath: string;
}

type SaveStatus = "idle" | "loading" | "saved" | "cannot_save" | "forbidden" | "error";

/**
 * "Keep this letter" button for the grace-window unsealed view.
 * POSTs to /api/letters/[id]/save; on success shows a small archive reward
 * with dashboard navigation.
 *
 * Known API statuses handled:
 *  - saved         → navigate to /dashboard/received/[id]
 *  - cannot_save   → inline error message
 *  - forbidden     → inline error message
 *  - no_profile    → navigate to /onboarding
 *  - unauthenticated → navigate to /login?next=<letterPath>
 */
export function KeepButton({ letterId, letterPath }: KeepButtonProps) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [isPending, startTransition] = useTransition();

  async function handleKeep() {
    if (isPending || status === "loading" || status === "saved") return;
    setStatus("loading");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/letters/${letterId}/save`, {
          method: "POST",
        });

        const data = (await res.json()) as { status: string };

        if (data.status === "saved") {
          setStatus("saved");
          return;
        }

        if (data.status === "cannot_save") {
          setStatus("cannot_save");
          return;
        }

        if (data.status === "forbidden") {
          setStatus("forbidden");
          return;
        }

        if (data.status === "no_profile") {
          // User is authenticated but has not completed onboarding
          window.location.href = "/onboarding";
          return;
        }

        if (data.status === "unauthenticated") {
          // User is not logged in — send them to login with a next= param so
          // they return here after signing in
          window.location.href = `/login?next=${encodeURIComponent(letterPath)}`;
          return;
        }

        setStatus("error");
      } catch {
        setStatus("error");
      }
    });
  }

  const messageMap: Partial<Record<SaveStatus, string>> = {
    cannot_save: "This letter can no longer be saved (it may have expired or already been kept).",
    forbidden: "You don't appear to be the opener of this letter.",
    error: "Something went wrong. Please try again.",
  };

  if (status === "saved") {
    return (
      <div className="mx-auto w-full max-w-sm rounded-lg border bg-background px-4 py-4 text-center shadow-sm">
        <p className="font-medium text-foreground">Letter kept.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It has been added to your kept letters.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/dashboard/received/${letterId}`}
            className={cn(buttonVariants(), "w-full sm:w-auto")}
          >
            Open
          </Link>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full sm:w-auto"
            )}
          >
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleKeep}
        disabled={isPending || status === "loading"}
        className={[
          "rounded-md px-6 py-2.5 text-sm font-medium font-sans",
          "bg-primary text-primary-foreground shadow-sm",
          "transition-colors duration-150",
          "hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        ].join(" ")}
      >
        {isPending || status === "loading" ? "Keeping it..." : "Keep this letter"}
      </button>

      {messageMap[status] && (
        <p role="alert" className="text-sm text-destructive text-center">
          {messageMap[status]}
        </p>
      )}
    </div>
  );
}
