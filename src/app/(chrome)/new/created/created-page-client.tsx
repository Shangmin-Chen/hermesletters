"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CopyLinkButton } from "./copy-link-button";

interface CreatedPageClientProps {
  fullUrl: string;
}

export function CreatedPageClient({ fullUrl }: CreatedPageClientProps) {
  const [linkSaved, setLinkSaved] = useState(false);

  return (
    <main className="flex flex-1 flex-col items-center p-4 pt-10 sm:p-6">
      <Card className="w-full max-w-xl animate-rise-in">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Letter sent!</CardTitle>
          <CardDescription>
            Copy this link and send it to your recipient.{" "}
            <strong className="text-foreground">
              Sent letters aren&apos;t stored anywhere
            </strong>{" "}
            — this is your only chance to copy it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border bg-muted/40 p-3 font-mono text-sm break-all select-all">
            {fullUrl}
          </div>

          <CopyLinkButton fullUrl={fullUrl} onCopied={() => setLinkSaved(true)} />

          {linkSaved ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/new" className={cn(buttonVariants(), "w-full sm:w-auto")}>
                Write another letter
              </Link>
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
              >
                Back to dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Copy the link first — then you can write another or go to your
                dashboard.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/new"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full sm:w-auto text-muted-foreground"
                  )}
                  onClick={(e) => {
                    if (
                      !window.confirm(
                        "You haven't copied the letter link yet. If you leave, it's gone forever. Leave anyway?"
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  Write another
                </Link>
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full sm:w-auto text-muted-foreground"
                  )}
                  onClick={(e) => {
                    if (
                      !window.confirm(
                        "You haven't copied the letter link yet. If you leave, it's gone forever. Leave anyway?"
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  Dashboard
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
