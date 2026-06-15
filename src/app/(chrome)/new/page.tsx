import { requireProfile } from "@/lib/auth";
import { NewLetterForm } from "./new-letter-form";

export default async function NewLetterPage() {
  const profile = await requireProfile();

  return (
    <main className="flex flex-1 flex-col items-center justify-start p-6 pt-8">
      <div className="w-full max-w-2xl space-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">
          Write a letter
        </h1>
        <p className="text-sm text-muted-foreground">
          Compose your letter, lock it with a secret, and share the link. You
          won&apos;t be able to view it again without burning it.
        </p>
      </div>
      <div className="w-full max-w-2xl mt-6">
        <NewLetterForm senderHandle={profile.handle as string} />
      </div>
    </main>
  );
}
