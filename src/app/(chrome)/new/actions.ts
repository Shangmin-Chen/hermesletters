"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { bodyOk, slugFieldOk, secretOk, type FieldKey } from "@/lib/letter-validation";
import { zipFilter } from "@/lib/zip-filter";
import { db } from "@/db";
import { letters, letterImages } from "@/db/schema";
import { adminClient } from "@/lib/supabase/admin";

// The return type gains an optional `field` discriminator so the client
// orchestrator can map an error back to the compose step that owns it (e.g. the
// duplicate-name 23505 collision, which is only detectable server-side, routes
// to the address step). The FormData INPUT contract is unchanged.
export type CreateLetterState = { error: string; field?: FieldKey } | null;

// ── Magic-byte image validation ──────────────────────────────────────────────
// Reads the first 12 bytes of a file and determines the real MIME type.
// Returns the detected mime string, or null if not a recognised image type.
// Allowed: PNG, JPEG, GIF, WEBP. SVG and everything else is rejected.
async function detectImageMime(file: File): Promise<string | null> {
  // We only need the first 12 bytes to cover all signatures.
  const slice = file.slice(0, 12);
  const buf = new Uint8Array(await slice.arrayBuffer());

  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: 47 49 46 38 ('GIF8')
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "image/gif";
  }

  // WEBP: 52 49 46 46 ('RIFF') at offset 0, then 57 45 42 50 ('WEBP') at offset 8
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }

  // Not a recognised/allowed image type (includes SVG, PDF, etc.)
  return null;
}

/**
 * Server action: create a new letter.
 *
 * Ordering (important — validation happens BEFORE any insert or upload):
 *   1. Auth guard — derive sender_id and sender_handle from the verified profile.
 *   2. Validate + slugify inputs; reject empties early.
 *   3. Read & validate all image bytes/types (magic bytes, not file.type).
 *   4. Compute answer_normalized and answer_shape.
 *   5. INSERT letters row — catch unique-violation (letters_url_unique) and
 *      return a friendly error WITHOUT uploading anything.
 *   6. Upload images (service-role client, private bucket) at {letterId}/{file}.
 *   7. INSERT letter_images rows.
 *   8. On image-phase failure: delete uploaded storage objects + letter row
 *      (best-effort cleanup so we don't leave a half-created letter),
 *      then RETURN a friendly error (no throw).
 *   9. Redirect to the confirmation page.
 */
export async function createLetterAction(
  _prevState: CreateLetterState,
  formData: FormData
): Promise<CreateLetterState> {
  // ── Step 1: Auth guard ──────────────────────────────────────────────────────
  // requireProfile() redirects if unauthenticated or no profile.
  // sender_id and sender_handle come ONLY from the server-verified profile.
  const profile = await requireProfile();
  const senderId: string = profile.id as string;
  const senderHandle: string = profile.handle as string;

  // ── Step 2: Validate + slugify inputs ──────────────────────────────────────
  const rawReceiverName = (formData.get("receiver_name") as string | null) ?? "";
  const rawLetterName = (formData.get("letter_name") as string | null) ?? "";
  const rawBody = (formData.get("body") as string | null) ?? "";
  const rawQuestion = (formData.get("question") as string | null) ?? "";
  const rawAnswer = (formData.get("answer") as string | null) ?? "";

  // Shared predicates (letter-validation.ts) keep these checks in lockstep with
  // the client step-gates. Each early return is tagged with its owning field so
  // the orchestrator can jump to the right step.
  if (!slugFieldOk(rawReceiverName)) {
    return rawReceiverName.trim()
      ? {
          error:
            "Receiver name produced an invalid slug — use letters, numbers, or spaces.",
          field: "receiver",
        }
      : { error: "Receiver name is required.", field: "receiver" };
  }
  if (!slugFieldOk(rawLetterName)) {
    return rawLetterName.trim()
      ? {
          error:
            "Letter name produced an invalid slug — use letters, numbers, or spaces.",
          field: "letter",
        }
      : { error: "Letter name is required.", field: "letter" };
  }
  if (!bodyOk(rawBody)) return { error: "Letter body is required.", field: "body" };
  if (!secretOk(rawQuestion, rawAnswer)) {
    return rawQuestion.trim()
      ? { error: "Answer is required.", field: "answer" }
      : { error: "Security question is required.", field: "question" };
  }

  const receiverName = slugify(rawReceiverName);
  const letterName = slugify(rawLetterName);

  // ── Step 3: Read & validate all image bytes/types BEFORE any DB insert ─────
  // We reject based on magic bytes (not client-supplied file.type).
  // This ensures no letter row is ever created for a rejected file.
  const imageFiles = formData.getAll("images") as File[];
  const rawCaptions = formData.getAll("caption") as string[];

  // Zip captions to their files BEFORE filtering so the indices stay aligned.
  // A zero-byte file (browser placeholder) drops its caption alongside itself.
  const rawCaptionsFilled = imageFiles.map((_, i) => rawCaptions[i] ?? "");
  const { a: validImages, b: validCaptions } = zipFilter(
    imageFiles,
    rawCaptionsFilled,
    (f) => f instanceof File && f.size > 0
  );

  // Read all array buffers and detect mime types up front.
  type ImageEntry = { file: File; buffer: ArrayBuffer; detectedMime: string };
  const imageEntries: ImageEntry[] = [];

  for (const file of validImages) {
    const detectedMime = await detectImageMime(file);
    if (!detectedMime) {
      return {
        error: `File "${file.name}" is not an accepted image type. Only PNG, JPEG, GIF, and WEBP are allowed.`,
        field: "body",
      };
    }
    // Read the full buffer now so we don't re-read later.
    const buffer = await file.arrayBuffer();
    imageEntries.push({ file, buffer, detectedMime });
  }

  // ── Step 4: Compute answer_normalized and answer_shape ─────────────────────
  //
  // answer_normalized: lowercased + outer-whitespace trimmed.
  //   Used for case-insensitive comparison on verify (inner spaces preserved).
  //
  // answer_shape: underline mask derived from answer.trim().
  //   Placeholder convention (also used by Phase 5 renderer):
  //     • every non-space character → "_"  (represents one underline slot)
  //     • space characters → " "           (kept as-is; renders as a blank gap)
  //   Example: "hello world" → "_____ _____"
  //   This encodes character count + space positions WITHOUT revealing the answer.
  const answerNormalized = rawAnswer.trim().toLowerCase();
  const answerShape = rawAnswer
    .trim()
    .replace(/[^ ]/g, "_"); // replace every non-space char with "_"

  // ── Step 5: Generate letterId up front & insert the letters row ───────────
  // Catch Postgres unique-violation (code 23505, constraint letters_url_unique)
  // and return a friendly error BEFORE any upload happens.
  const letterId = crypto.randomUUID();

  try {
    await db.insert(letters).values({
      id: letterId,
      senderId,
      senderHandle,
      receiverName,
      letterName,
      body: rawBody.trim(),
      question: rawQuestion.trim(),
      answerNormalized,
      answerShape,
      status: "unopened",
    });
  } catch (err: unknown) {
    // postgres.js exposes constraint_name; pg/node-postgres exposes constraint.
    // Accept either to be robust against driver differences.
    const pgErr = err as { code?: string; constraint_name?: string; constraint?: string };
    if (
      pgErr?.code === "23505" &&
      (pgErr?.constraint_name === "letters_url_unique" ||
        pgErr?.constraint === "letters_url_unique")
    ) {
      // The collision is on the (handle, receiver, letter) URL triple; the
      // letter name is the field the user can most easily change, so route the
      // bounce to the address step where that field lives.
      return {
        error: "That letter name is already taken — choose another.",
        field: "letter",
      };
    }
    // Re-throw unexpected errors so they surface as 500s.
    throw err;
  }

  // ── Step 6: Upload images (service-role, private bucket) ─────────────────
  // Images go to: letters/{letterId}/{safeFilename}
  // Filenames are sanitized (no path separators, no leading dots, no control bytes)
  // and prefixed with their 0-based index to avoid collisions from duplicate names.
  // We use the DETECTED mime type as contentType (not file.type).
  const uploadedPaths: string[] = [];

  for (let i = 0; i < imageEntries.length; i++) {
    const { file, buffer, detectedMime } = imageEntries[i];

    // Fix 5: Sanitize filename — strip path separators, leading dots, control/null bytes.
    const safeName =
      file.name
        .replace(/[/\\]/g, "")
        .replace(/[\x00-\x1f]/g, "")
        .replace(/^\.+/, "") || "image";
    const storagePath = `${letterId}/${i}-${safeName}`;

    const { error: uploadError } = await adminClient.storage
      .from("letters")
      .upload(storagePath, buffer, {
        contentType: detectedMime, // use detected type, not file.type
        upsert: false,
      });

    if (uploadError) {
      // ── Step 8 (failure cleanup): delete uploaded objects + letter row ──
      await Promise.allSettled(
        uploadedPaths.map((p) =>
          adminClient.storage.from("letters").remove([p])
        )
      ).catch((e) => console.error("[createLetterAction] cleanup error:", e));
      await db.delete(letters).where(eq(letters.id, letterId)).catch((e) =>
        console.error("[createLetterAction] cleanup error deleting letter:", e)
      );
      // Fix 4: Return friendly error instead of throwing, so form stays mounted.
      // Image upload/registration failures route to the paper step (where the
      // photo input lives) so the banner is shown beside the relevant control.
      return {
        error: "Something went wrong saving your letter. Please try again.",
        field: "body",
      };
    }

    uploadedPaths.push(storagePath);
  }

  // ── Step 7: Insert letter_images rows ────────────────────────────────────
  if (uploadedPaths.length > 0) {
    try {
      await db.insert(letterImages).values(
        uploadedPaths.map((storagePath, position) => ({
          letterId,
          storagePath,
          position,
          caption: [...(validCaptions[position] ?? "").trim()].slice(0, 200).join("") || null,
        }))
      );
    } catch {
      // ── Step 8 (failure cleanup): delete uploaded objects + letter row ──
      await Promise.allSettled(
        uploadedPaths.map((p) =>
          adminClient.storage.from("letters").remove([p])
        )
      ).catch((e) => console.error("[createLetterAction] cleanup error:", e));
      await db.delete(letters).where(eq(letters.id, letterId)).catch((e) =>
        console.error("[createLetterAction] cleanup error deleting letter:", e)
      );
      // Fix 4: Return friendly error instead of throwing, so form stays mounted.
      // Image upload/registration failures route to the paper step (where the
      // photo input lives) so the banner is shown beside the relevant control.
      return {
        error: "Something went wrong saving your letter. Please try again.",
        field: "body",
      };
    }
  }

  // ── Step 9: Redirect to confirmation page ─────────────────────────────────
  const params = new URLSearchParams({
    handle: senderHandle,
    receiver: receiverName,
    letter: letterName,
  });
  redirect(`/new/created?${params.toString()}`);
}
