import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { CreatedPageClient } from "./created-page-client";

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

  return <CreatedPageClient fullUrl={fullUrl} />;
}
