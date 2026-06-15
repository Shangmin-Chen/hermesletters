"use client";

import { useState, useRef, useEffect } from "react";
import { Check, Copy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyLinkButtonProps {
  fullUrl: string;
  onCopied?: () => void;
}

export function CopyLinkButton({ fullUrl, onCopied }: CopyLinkButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const urlRef = useRef<HTMLElement | null>(null);

  // Register a beforeunload guard until the link is copied
  useEffect(() => {
    if (status === "copied") return; // already copied — no guard needed

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Modern browsers ignore the message and show their own dialog
      e.returnValue =
        "You haven't copied the letter link yet. If you leave, it's gone forever.";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [status]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setStatus("copied");
      onCopied?.();
    } catch {
      // Clipboard API unavailable or permission denied — fall back to selection
      setStatus("error");

      // Try to select the URL text so the user can press ⌘/Ctrl+C
      if (urlRef.current) {
        const range = document.createRange();
        range.selectNodeContents(urlRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={handleCopy}
          variant={status === "copied" ? "default" : "outline"}
          className="w-full sm:w-auto"
          type="button"
          aria-label={
            status === "copied"
              ? "Letter link copied"
              : status === "error"
                ? "Copy failed — select text and press Ctrl/⌘+C"
                : "Copy letter link"
          }
          aria-pressed={status === "copied"}
        >
          {status === "copied" ? (
            <span className="flex items-center gap-2">
              <Check className="size-4" aria-hidden="true" />
              Copied!
            </span>
          ) : status === "error" ? (
            <span className="flex items-center gap-2">
              <AlertCircle className="size-4" aria-hidden="true" />
              Copy failed
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Copy className="size-4" aria-hidden="true" />
              Copy link
            </span>
          )}
        </Button>
      </div>

      {status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t copy automatically.{" "}
          <span
            ref={urlRef}
            className="select-all font-mono text-xs break-all bg-muted px-1 rounded"
          >
            {fullUrl}
          </span>{" "}
          — select the link above and press{" "}
          <kbd className="rounded border px-1 font-mono text-xs">⌘C</kbd> /{" "}
          <kbd className="rounded border px-1 font-mono text-xs">Ctrl+C</kbd>.
        </p>
      )}
    </div>
  );
}
