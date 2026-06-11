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
      // Fallback: select the text in the input
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
      variant="outline"
      className="w-full"
      type="button"
    >
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}
