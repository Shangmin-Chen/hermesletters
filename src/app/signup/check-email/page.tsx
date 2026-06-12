import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { Envelope } from "@/components/brand/Envelope";

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-rise-in space-y-8">
        {/* Illustration */}
        <div className="flex flex-col items-center gap-4 text-center">
          <Envelope state="open" className="w-16 h-16 text-ink" aria-hidden />
          <Wordmark size="sm" className="text-muted-foreground" />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8 text-center space-y-4">
          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-semibold text-ink tracking-tight">
              Check your inbox
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent you a confirmation link. Click it to verify your email
              and you&apos;ll be ready to write your first letter.
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Already confirmed?{" "}
              <Link
                href="/login"
                className="text-ink underline underline-offset-4 hover:text-wax transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Can&apos;t find it? Check your spam folder.
        </p>
      </div>
    </main>
  );
}
