"use client";

import { useState, useEffect } from "react";
import { CopyLinkButton } from "./copy-link-button";

interface CreatedPageClientProps {
  fullUrl: string;
}

export function CreatedPageClient({ fullUrl }: CreatedPageClientProps) {
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasCopied) {
        // Modern browsers show their own generic message; setting returnValue triggers the dialog
        e.preventDefault();
        e.returnValue =
          "You haven't copied the link yet — once you leave, it won't appear again.";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasCopied]);

  return (
    <CopyLinkButton
      fullUrl={fullUrl}
      onCopied={() => setHasCopied(true)}
    />
  );
}
