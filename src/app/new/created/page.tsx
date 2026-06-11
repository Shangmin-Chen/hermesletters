import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyLinkButton } from "./copy-link-button";
import { requireProfile } from "@/lib/auth";

interface CreatedPageProps {
  searchParams: Promise<{ handle?: string; receiver?: string; letter?: string }>;
}

export default async function LetterCreatedPage({ searchParams }: CreatedPageProps) {
  // Fix 6: Auth-gate — sender must be logged in to view the confirmation page.
  await requireProfile();

  const params = await searchParams;
  const { handle, receiver, letter } = params;

  // If the required params are missing, send to /new.
  if (!handle || !receiver || !letter) {
    redirect("/new");
  }

  const letterPath = `/${handle}/${receiver}/${letter}`;

  // Fix 6: Derive the full absolute URL server-side.
  // Priority: NEXT_PUBLIC_SITE_URL env var → request headers (origin / x-forwarded-proto + host).
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
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Letter sent!</CardTitle>
          <CardDescription>
            Your letter has been sealed and locked. Share the link below with the receiver.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prominent URL display — shows the full absolute URL */}
          <div className="rounded-md border border-border bg-muted px-4 py-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Shareable link</p>
            <p className="font-mono text-sm break-all text-foreground">{fullUrl}</p>
          </div>

          {/* Copy affordance — passes the full URL so the button copies exactly what is displayed */}
          <CopyLinkButton fullUrl={fullUrl} />

          {/* Important notice */}
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              This is the only time you can grab the link.
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              You have no sent history. Opening the letter yourself burns it — the receiver won&apos;t
              be able to read it.
            </p>
          </div>

          <div className="text-center">
            <a
              href="/new"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Write another letter
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
