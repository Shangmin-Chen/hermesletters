import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Envelope } from "@/components/brand/Envelope";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function LetterSentPage() {
  await requireProfile();

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center animate-rise-in">
        <div className="flex justify-center">
          <Envelope state="sealed" className="h-16 w-16 text-wax" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">
            Your letter is on its way
          </h1>
          <p className="text-sm text-muted-foreground">
            It&apos;s waiting sealed in their inbox. They&apos;ll break the seal
            to read it — and it stays with them for good.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className={cn(buttonVariants(), "w-full sm:w-auto")}
          >
            Back to dashboard
          </Link>
          <Link
            href="/phonebook"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full sm:w-auto"
            )}
          >
            Phonebook
          </Link>
        </div>
      </div>
    </main>
  );
}
