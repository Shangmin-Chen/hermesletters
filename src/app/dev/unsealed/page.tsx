import { UnsealedView } from "@/app/[handle]/[receiver]/[letter]/letter-views";
import { DevBack } from "../DevBack";
import { DevRevealReplay } from "../DevRevealReplay";

const FIXTURE_BODY = `Dear Eleanor,

The snow hasn't stopped since Tuesday. I keep the fire going and think of the winter we drove to the coast with no plan and no map — just the thermos and that terrible mixtape.

I never told you what that trip meant to me. So here it is, sealed and sent.

Yours,
Tom`;

// Fixture expiry ~24h out. Computed once at module load (not during render) so
// the harness stays a pure component; good enough for a static demo.
const EXPIRES_AT = new Date(Date.now() + 24 * 60 * 60 * 1000);

// Shows the logged-out variant (richest footer: both keep links). The reveal
// plays once per "▶ Replay reveal" press (sets the one-shot sessionStorage flag
// RevealOnce reads). Body is server-rendered and readable from frame one.
export default function DevUnsealed() {
  return (
    <>
      <DevBack />
      <DevRevealReplay letterId="dev-unsealed" />
      <UnsealedView
        body={FIXTURE_BODY}
        imageUrls={[
          "/textures/cream-paper.png",
          "/textures/natural-paper.png",
          "/textures/cream-paper.png",
        ]}
        letterId="dev-unsealed"
        expiresAt={EXPIRES_AT}
        isLoggedIn={false}
        hasProfile={false}
        letterPath="/demo/eleanor/snow-2026"
      />
    </>
  );
}
