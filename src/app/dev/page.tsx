import Link from "next/link";

const routes = [
  {
    href: "/dev/compose",
    label: "Compose flow",
    desc: "Simple form fixture using the same UI as /new.",
  },
  {
    href: "/dev/locked",
    label: "Locked letter",
    desc: "The sealed envelope a recipient first sees, with the wax-unseal gesture.",
  },
  {
    href: "/dev/unsealing",
    label: "Wax-unseal gesture",
    desc: "WaxUnseal standalone — press and hold the seal to break it. Use Replay to re-play.",
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
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">QA harness</h1>
          <p className="text-sm text-muted-foreground">
            Dev-only fixtures for the remaining working surfaces.
          </p>
        </header>

        <ul className="flex flex-col gap-3">
          {routes.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="block rounded-lg border bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary/40"
              >
                <span className="font-medium">{r.label}</span>
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
