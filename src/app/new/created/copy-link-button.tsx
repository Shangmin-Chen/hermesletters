"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyLinkButtonProps {
  fullUrl: string;
  onCopied?: () => void;
}

export function CopyLinkButton({ fullUrl, onCopied }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement("input");
      input.value = fullUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    // Persistent — never reverts to "Copy link"
    setCopied(true);
    onCopied?.();
  }

  return (
    <Button
      onClick={handleCopy}
      variant={copied ? "default" : "outline"}
      className={
        copied
          ? "w-full bg-wax text-primary-foreground hover:bg-wax-deep transition-all rounded-full"
          : "w-full border-border text-ink hover:bg-muted transition-all rounded-full"
      }
      type="button"
      aria-label={copied ? "Link copied to clipboard" : "Copy shareable link"}
      aria-pressed={copied}
    >
      {copied ? (
        <span className="flex items-center gap-2">
          <span aria-hidden>✓</span> Copied
        </span>
      ) : (
        "Copy link"
      )}
    </Button>
  );
}
