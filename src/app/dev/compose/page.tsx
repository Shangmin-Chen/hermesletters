import { ComposeLetter } from "@/app/new/ComposeLetter";
import { DevBack } from "../DevBack";

// Mirrors the real /new wrapper so the compose ritual sits in its usual card.
// Note: submitting calls the real server action (requireProfile → redirect to
// login). For QA of the scenes + fold you don't submit — just drive the steps.
export default function DevCompose() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-16">
      <DevBack />
      <div className="w-full max-w-xl">
        <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8 sm:px-8">
          <ComposeLetter senderHandle="demo" />
        </div>
      </div>
    </main>
  );
}
