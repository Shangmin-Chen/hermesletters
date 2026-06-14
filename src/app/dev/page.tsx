import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

const routes = [
  {
    href: "/dev/compose",
    label: "Compose ritual",
    desc: "The full write → fold → address → seal flow. Drive the fold here.",
  },
  {
    href: "/dev/locked",
    label: "Locked letter",
    desc: "The sealed envelope a recipient first sees, with the secret prompt.",
  },
  {
    href: "/dev/unsealed",
    label: "Unsealed letter",
    desc: "The reveal + letter-on-paper. Use “Replay reveal” to re-play it.",
  },
  {
    href: "/dev/sealed",
    label: "Sealed / closed",
    desc: "The already-opened / expired closing view.",
  },
];

export default function DevIndex() {
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl animate-rise-in">
        <header className="mb-8 flex flex-col items-center gap-2 text-center">
          <Wordmark size="sm" className="text-muted-foreground" />
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
            QA harness
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Dev-only. Real components, fixture data — no auth, no database. 404s
            in production.
          </p>
        </header>

        <ul className="flex flex-col gap-3">
          {routes.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="group block rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:border-wax/60"
              >
                <span className="font-serif text-base font-semibold text-ink group-hover:text-wax transition-colors">
                  {r.label}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {r.desc}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
