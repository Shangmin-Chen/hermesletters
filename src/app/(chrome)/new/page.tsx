import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { areConnected } from "@/lib/connections";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { NewLetterForm } from "./new-letter-form";

export default async function NewLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const profile = await requireProfile();
  const { to } = await searchParams;

  // Direct mode: `?to=<handle>` must resolve to an existing connection. If it
  // doesn't (no such handle, or not connected), silently fall back to invite mode
  // — never leak whether a handle exists.
  let directRecipient: { handle: string; displayName: string | null } | null =
    null;
  if (to) {
    const [recipient] = await db
      .select({
        id: profiles.id,
        handle: profiles.handle,
        displayName: profiles.displayName,
      })
      .from(profiles)
      .where(eq(profiles.handle, to))
      .limit(1);

    if (recipient && (await areConnected(profile.id, recipient.id))) {
      directRecipient = {
        handle: recipient.handle,
        displayName: recipient.displayName,
      };
    } else {
      redirect("/new");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-start p-6 pt-8">
      <div className="w-full max-w-2xl space-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">
          {directRecipient
            ? `Write to @${directRecipient.handle}`
            : "Write a letter"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {directRecipient
            ? "Compose your letter and seal it — it lands straight in their inbox, ready to open and keep."
            : "Compose your letter, seal it with a shared secret, and send a link that opens once."}
        </p>
      </div>
      <div className="w-full max-w-2xl mt-6">
        <NewLetterForm
          senderHandle={profile.handle as string}
          directRecipient={directRecipient ?? undefined}
        />
      </div>
    </main>
  );
}
