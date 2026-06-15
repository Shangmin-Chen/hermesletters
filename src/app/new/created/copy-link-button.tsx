"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
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
      setCopied(true);
      onCopied?.();
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      onClick={handleCopy}
      variant={copied ? "default" : "outline"}
      className="w-full sm:w-auto"
      type="button"
      aria-label={copied ? "Letter link copied" : "Copy letter link"}
      aria-pressed={copied}
    >
      {copied ? (
        <span className="flex items-center gap-2">
          <Check className="size-4" aria-hidden="true" />
          Copied
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Copy className="size-4" aria-hidden="true" />
          Copy link
        </span>
      )}
    </Button>
  );
}
