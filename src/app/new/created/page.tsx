import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CreatedPageClient } from "./created-page-client";
import { requireProfile } from "@/lib/auth";
import { Wordmark } from "@/components/brand/Wordmark";
import { Envelope } from "@/components/brand/Envelope";

interface CreatedPageProps {
  searchParams: Promise<{ handle?: string; receiver?: string; letter?: string }>;
}

export default async function LetterCreatedPage({ searchParams }: CreatedPageProps) {
  await requireProfile();

  const params = await searchParams;
  const { handle, receiver, letter } = params;

  if (!handle || !receiver || !letter) {
    redirect("/new");
  }

  const letterPath = `/${handle}/${receiver}/${letter}`;

  let origin: string;
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origin = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  } else {
    const headersList = await headers();
    const requestOrigin = headersList.get("origin");
    if (requestOrigin) {
      origin = requestOrigin;
    } else {
      const proto = headersList.get("x-forwarded-proto") ?? "http";
      const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
      origin = `${proto}://${host}`;
    }
  }

  const fullUrl = `${origin}${letterPath}`;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg animate-rise-in space-y-8">
        {/* Header — your sealed letter, resting on the desk, ready to hand off */}
        <header className="flex flex-col items-center gap-4 text-center">
          <Envelope
            state="sealed"
            className="w-20 h-20 text-ink animate-wax-pulse drop-shadow-[0_8px_24px_oklch(0_0_0/0.18)]"
            aria-hidden
          />
          <Wordmark size="sm" className="text-muted-foreground" />
          <div className="space-y-1.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              It&apos;s sealed.
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Hand this link to them — that&apos;s all it takes. The letter waits,
              sealed, until they open it.
            </p>
          </div>
        </header>

        {/* The sealed letter, ready to hand off */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-md px-6 py-7 space-y-6">
          {/* URL display — the address slip on the envelope */}
          <div className="rounded-xl bg-muted/50 border border-border/70 px-4 py-4 space-y-1.5">
            <p className="text-xs font-medium text-wax uppercase tracking-[0.16em]">
              Their link
            </p>
            <p className="font-mono text-sm break-all text-ink">{fullUrl}</p>
          </div>

          {/* Copy button — client wrapper owns beforeunload + persistent copied state */}
          <CreatedPageClient fullUrl={fullUrl} />

          {/* Warning notice — using brand tokens instead of raw amber */}
          <div className="rounded-lg border border-wax/30 bg-wax/10 px-4 py-4 space-y-1">
            <p className="text-sm font-semibold text-ink">
              This link won&apos;t appear again.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have no sent history. If you open the letter yourself, it burns —
              they won&apos;t get to read it.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <Link
              href="/new"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
            >
              Write another letter
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
