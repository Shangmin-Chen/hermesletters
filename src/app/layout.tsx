import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Hermes' Letters",
    template: "%s · Hermes' Letters",
  },
  description: "Write something real. Seal it with a link that opens once.",
};

/**
 * Inline script that runs before first paint to apply the correct theme class
 * without a flash. Reads localStorage "theme" (set by the ThemeToggle in
 * SiteHeader) and falls back to the OS prefers-color-scheme media query.
 * Kept as a string to avoid any module-level side effects.
 */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (!stored && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The no-flash theme script (first child of <body>) mutates <html>'s
      // class before React hydrates, so the live class (e.g. "... dark") won't
      // match the server-rendered class. suppressHydrationWarning tells React to
      // tolerate that difference on this element's own attributes — without it
      // the root-node mismatch is unrecoverable in dev and triggers a reload loop.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
       * IMPORTANT: do not author a manual <head> here. In the App Router,
       * Next/React 19 own <head> and hoist metadata into it; a hand-written
       * <head> has a React child-list (just this script) that can't reconcile
       * against the real DOM head (Next's injected meta/link/title/scripts),
       * producing an unrecoverable head-subtree hydration mismatch -> dev
       * reload loop. Instead, the no-flash script is the first child of <body>:
       * it executes during parse, before the page content paints, so there's
       * no flash, and it lives in a head that Next fully manages.
       */}
      <body className="min-h-full flex flex-col">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional no-flash script */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
