"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyLinkButtonProps {
  fullUrl: string;
}

export function CopyLinkButton({ fullUrl }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.createElement("input");
      input.value = fullUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
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
    >
      {copied ? "Copied to clipboard" : "Copy link"}
    </Button>
  );
}
