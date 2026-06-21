import { LockedView } from "@/app/[handle]/[receiver]/[letter]/letter-views";
import { DevBack } from "../DevBack";

// Note: the WaxUnseal gesture posts to /api/letters/dev-locked/verify on unseal,
// which 404s (no such letter). For visual QA of the locked scene that's fine —
// the gesture animation still plays.
export default function DevLocked() {
  return (
    <>
      <DevBack />
      <LockedView
        letterId="dev-locked"
        senderHandle="demo"
        receiverName="eleanor"
        secretPrompt="What did we call the blue house?"
        answerShape="_________"
        openToken="dev-open-token"
      />
    </>
  );
}
