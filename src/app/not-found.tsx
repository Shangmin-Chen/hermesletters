import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          <div className="bg-neutral-100 border-b border-neutral-200 px-6 py-4 text-center">
            <span className="text-2xl" role="img" aria-label="Not found">
              ✉
            </span>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Letter Not Found
            </p>
          </div>
          <div className="px-6 py-10 flex flex-col items-center gap-4">
            <p className="text-neutral-600 text-base">
              This letter doesn&rsquo;t exist, or the link may be incorrect.
            </p>
            <Link
              href="/"
              className="text-sm underline text-neutral-500 hover:text-neutral-800"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
