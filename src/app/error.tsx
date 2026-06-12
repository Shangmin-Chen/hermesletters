"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { Envelope } from "@/components/brand/Envelope";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-rise-in space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Envelope state="open" className="w-16 h-16 text-ink" aria-hidden />
          <Wordmark size="sm" className="text-muted-foreground" />
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8 space-y-5">
          <div className="space-y-2">
            <h1 className="font-serif text-xl font-semibold text-ink tracking-tight">
              Something went astray
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              An unexpected error occurred — like a letter lost in the post.
              Try again and it should find its way.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={reset}
              className="w-full bg-wax text-primary-foreground hover:opacity-90 transition-opacity rounded-full font-medium shadow-sm"
              type="button"
            >
              Try again
            </Button>
            <Link
              href="/"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-ink transition-colors min-h-[44px] inline-flex items-center justify-center"
            >
              Back home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
