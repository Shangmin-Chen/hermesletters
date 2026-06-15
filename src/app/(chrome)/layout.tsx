import { SiteHeader } from "@/components/SiteHeader";

/**
 * Chrome layout — wraps all marketing and authenticated-sender routes with the
 * sticky SiteHeader. Routes that must render bare (letter-reading pages,
 * dev previews) stay outside this group and inherit the root layout directly.
 */
export default function ChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
