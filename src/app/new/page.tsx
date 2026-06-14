import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Wordmark } from "@/components/brand/Wordmark";
import { ComposeLetter } from "./ComposeLetter";

export default async function NewLetterPage() {
  const profile = await requireProfile();

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-10 sm:py-16">
      {/* Back to dashboard */}
      <div className="w-full max-w-xl mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-ink transition-colors"
        >
          &larr; Dashboard
        </Link>
      </div>

      {/* Page header */}
      <header className="mb-8 flex flex-col items-center gap-2 animate-rise-in">
        <Wordmark size="sm" className="text-muted-foreground" />
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
          Write a letter
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs text-center leading-relaxed">
          Seal it with a secret. Share the link. It opens once.
        </p>
      </header>

      {/* Form card */}
      <div className="w-full max-w-xl animate-rise-in" style={{ animationDelay: "60ms" }}>
        <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8 sm:px-8">
          {/* No-JS hint: the compose ritual is irreducibly client-driven (draft
              autosave, image previews, slug preview, the fold gesture). With JS
              off, surface a plain message instead of a half-broken form. */}
          <noscript>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writing a letter needs JavaScript enabled — it saves your draft,
              previews photos, and folds the letter into its envelope as you go.
              Please turn JavaScript on and reload this page.
            </p>
          </noscript>

          <ComposeLetter senderHandle={profile.handle as string} />
        </div>
      </div>
    </main>
  );
}
