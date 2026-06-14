import { notFound } from "next/navigation";

/**
 * Dev-only QA harness.
 *
 * This entire `/dev` subtree renders real app components with FIXTURE props —
 * no auth, no database, no real letters. It exists so the compose ritual, the
 * fold, and the letter views can be QA'd in isolation (in the browser, by hand
 * or by an agent) without logging in or seeding data.
 *
 * SECURITY: it renders ONLY synthetic, hardcoded data and is hard-gated to
 * development here — every `/dev/*` route 404s in production. It is never a
 * path to real letter content (that stays behind the cookie-gated grace branch
 * in the real letter page), so it adds no attack surface.
 */
export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
