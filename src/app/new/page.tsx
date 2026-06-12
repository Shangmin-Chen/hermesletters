import { requireProfile } from "@/lib/auth";
import { Wordmark } from "@/components/brand/Wordmark";
import { NewLetterForm } from "./new-letter-form";

export default async function NewLetterPage() {
  const profile = await requireProfile();

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-10 sm:py-16">
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
          <NewLetterForm senderHandle={profile.handle as string} />
        </div>
      </div>
    </main>
  );
}
