import { LockedView } from "@/app/[handle]/[receiver]/[letter]/letter-views";
import { DevBack } from "../DevBack";

// Note: the answer input posts to /api/letters/dev-locked/verify on submit,
// which 404s (no such letter). For visual QA of the locked scene that's fine —
// don't submit.
export default function DevLocked() {
  return (
    <>
      <DevBack />
      <LockedView
        letterId="dev-locked"
        question="What did we name the terrible mixtape?"
        answerShape="__________"
        senderHandle="demo"
        receiverName="eleanor"
      />
    </>
  );
}
