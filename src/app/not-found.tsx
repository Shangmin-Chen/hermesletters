import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { Envelope } from "@/components/brand/Envelope";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-rise-in space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Envelope state="open" className="w-16 h-16 text-ink" aria-hidden />
          <Wordmark size="sm" className="text-muted-foreground" />
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8 space-y-5">
          <div className="space-y-2">
            <h1 className="font-serif text-xl font-semibold text-ink tracking-tight">
              This letter got lost
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We couldn&apos;t find what you were looking for — the link may be wrong,
              or the letter may have already been opened.
            </p>
          </div>

          <Link
            href="/"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
