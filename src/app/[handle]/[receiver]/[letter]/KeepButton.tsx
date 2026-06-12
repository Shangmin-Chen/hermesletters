"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface KeepButtonProps {
  letterId: string;
  /** Full path of this letter page, e.g. "/handle/receiver/letter" */
  letterPath: string;
}

type SaveStatus = "idle" | "loading" | "saved" | "cannot_save" | "forbidden" | "error";

/**
 * "Keep this letter" button for the grace-window unsealed view.
 * POSTs to /api/letters/[id]/save; on success navigates to the
 * received-letter view in the dashboard.
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
  const router = useRouter();

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
          // Navigate to the received-letter view (permanent home)
          router.push(`/dashboard/received/${letterId}`);
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
          router.push("/onboarding");
          return;
        }

        if (data.status === "unauthenticated") {
          // User is not logged in — send them to login with a next= param so
          // they return here after signing in
          router.push(`/login?next=${encodeURIComponent(letterPath)}`);
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

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleKeep}
        disabled={isPending || status === "loading" || status === "saved"}
        className={[
          "rounded-full px-6 py-2.5 text-sm font-medium font-sans",
          "bg-primary text-primary-foreground shadow-sm",
          "transition-all duration-150",
          "hover:bg-wax-deep hover:shadow-md active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100",
        ].join(" ")}
      >
        {status === "saved"
          ? "Saved — on your way…"
          : isPending || status === "loading"
          ? "Keeping it…"
          : "Keep this letter"}
      </button>

      {messageMap[status] && (
        <p role="alert" className="text-sm text-destructive text-center">
          {messageMap[status]}
        </p>
      )}
    </div>
  );
}
