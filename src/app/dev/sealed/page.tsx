import { SealedView } from "@/app/[handle]/[receiver]/[letter]/letter-views";
import { DevBack } from "../DevBack";

export default function DevSealed() {
  return (
    <>
      <DevBack />
      <SealedView message="This letter has already been opened — it found its person." />
    </>
  );
}
