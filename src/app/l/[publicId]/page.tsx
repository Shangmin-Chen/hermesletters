import "server-only";

export const dynamic = "force-dynamic";

import { renderLetterShared } from "@/app/letter-page-shared";

interface PageProps {
  params: Promise<{
    publicId: string;
  }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function PublicLetterPage({ params, searchParams }: PageProps) {
  const { publicId } = await params;
  const { t: openToken } = await searchParams;

  return renderLetterShared(
    {
      kind: "publicId",
      publicId,
    },
    openToken
  );
}
