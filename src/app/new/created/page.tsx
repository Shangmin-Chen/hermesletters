import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
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
      const host =
        headersList.get("x-forwarded-host") ??
        headersList.get("host") ??
        "localhost:3000";
      origin = `${proto}://${host}`;
    }
  }

  const fullUrl = `${origin}${letterPath}`;

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4 pt-10 sm:p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Letter created</CardTitle>
          <CardDescription>
            Copy this link before you leave. Sent letters are not stored in your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border bg-muted/40 p-3 font-mono text-sm break-all">
            {fullUrl}
          </div>

          <CopyLinkButton fullUrl={fullUrl} />

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
        </CardContent>
      </Card>
    </main>
  );
}
