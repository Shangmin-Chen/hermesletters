"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to the console in development; in production wire to your error
    // reporting service here (e.g. Sentry).  Never surface error.message to
    // the rendered UI to avoid leaking internal details.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          <div className="bg-neutral-100 border-b border-neutral-200 px-6 py-4 text-center">
            <span className="text-2xl" role="img" aria-label="Error">
              ✉
            </span>
            <p className="mt-1 text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Something went wrong
            </p>
          </div>
          <div className="px-6 py-10 flex flex-col items-center gap-4">
            <p className="text-neutral-600 text-base">
              An unexpected error occurred. Please try again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="text-sm underline text-neutral-500 hover:text-neutral-800"
              >
                Try again
              </button>
              <span className="text-neutral-300">·</span>
              <Link
                href="/"
                className="text-sm underline text-neutral-500 hover:text-neutral-800"
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
