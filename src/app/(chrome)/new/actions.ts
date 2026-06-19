"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { bodyOk, slugFieldOk, type FieldKey } from "@/lib/letter-validation";
import { zipFilter } from "@/lib/zip-filter";
import { areConnected } from "@/lib/connections";
import { db } from "@/db";
import { letters, letterImages, profiles } from "@/db/schema";
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
 * Shared image pipeline for both the invite (createLetterAction) and direct
 * (sendDirectLetterAction) flows. MUST be called AFTER the `letters` row for
 * `letterId` is inserted. Reads `images` + `caption` FormData, validates by magic
 * bytes, uploads to the private bucket, and inserts `letter_images` rows.
 *
 * Returns null on success, or a friendly { error, field } on failure — and on any
 * failure it best-effort cleans up uploaded objects AND deletes the half-created
 * `letters` row so we never leave a partial letter behind.
 */
async function processLetterContent(
  letterId: string,
  formData: FormData
): Promise<CreateLetterState> {
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

  // Best-effort rollback of a half-created letter on any failure.
  const cleanup = async (uploaded: string[]) => {
    await Promise.allSettled(
      uploaded.map((p) => adminClient.storage.from("letters").remove([p]))
    ).catch((e) => console.error("[processLetterContent] cleanup error:", e));
    await db
      .delete(letters)
      .where(eq(letters.id, letterId))
      .catch((e) =>
        console.error("[processLetterContent] cleanup deleting letter:", e)
      );
  };

  // Read & validate all image bytes/types up front (magic bytes, not file.type).
  type ImageEntry = { file: File; buffer: ArrayBuffer; detectedMime: string };
  const imageEntries: ImageEntry[] = [];
  for (const file of validImages) {
    const detectedMime = await detectImageMime(file);
    if (!detectedMime) {
      await cleanup([]);
      return {
        error: `File "${file.name}" is not an accepted image type. Only PNG, JPEG, GIF, and WEBP are allowed.`,
        field: "body",
      };
    }
    const buffer = await file.arrayBuffer();
    imageEntries.push({ file, buffer, detectedMime });
  }

  // Upload images to letters/{letterId}/{i}-{safeName} using the DETECTED mime.
  const uploadedPaths: string[] = [];
  for (let i = 0; i < imageEntries.length; i++) {
    const { file, buffer, detectedMime } = imageEntries[i];
    const safeName =
      file.name
        .replace(/[/\\]/g, "")
        .replace(/[\x00-\x1f]/g, "")
        .replace(/^\.+/, "") || "image";
    const storagePath = `${letterId}/${i}-${safeName}`;

    const { error: uploadError } = await adminClient.storage
      .from("letters")
      .upload(storagePath, buffer, { contentType: detectedMime, upsert: false });

    if (uploadError) {
      await cleanup(uploadedPaths);
      return {
        error: "Something went wrong saving your letter. Please try again.",
        field: "body",
      };
    }
    uploadedPaths.push(storagePath);
  }

  // Insert letter_images rows.
  if (uploadedPaths.length > 0) {
    try {
      await db.insert(letterImages).values(
        uploadedPaths.map((storagePath, position) => ({
          letterId,
          storagePath,
          position,
          caption:
            [...(validCaptions[position] ?? "").trim()].slice(0, 200).join("") ||
            null,
        }))
      );
    } catch {
      await cleanup(uploadedPaths);
      return {
        error: "Something went wrong saving your letter. Please try again.",
        field: "body",
      };
    }
  }

  return null;
}

/**
 * Server action: create a new letter.
 *
 * Ordering (important — validation happens BEFORE any insert or upload):
 *   1. Auth guard — derive sender_id and sender_handle from the verified profile.
 *   2. Validate + slugify inputs; reject empties early.
 *   3. Read & validate all image bytes/types (magic bytes, not file.type).
 *   4. INSERT letters row — catch unique-violation (letters_url_unique) and
 *      return a friendly error WITHOUT uploading anything.
 *   5. Upload images (service-role client, private bucket) at {letterId}/{file}.
 *   6. INSERT letter_images rows.
 *   7. On image-phase failure: delete uploaded storage objects + letter row
 *      (best-effort cleanup so we don't leave a half-created letter),
 *      then RETURN a friendly error (no throw).
 *   8. Redirect to the confirmation page.
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

  const receiverName = slugify(rawReceiverName);
  const letterName = slugify(rawLetterName);

  // ── Step 3: Insert the letters row ────────────────────────────────────────
  // Catch Postgres unique-violation (code 23505, constraint letters_url_unique)
  // and return a friendly error before processing images.
  const letterId = crypto.randomUUID();

  try {
    await db.insert(letters).values({
      id: letterId,
      senderId,
      senderHandle,
      receiverName,
      letterName,
      body: rawBody.trim(),
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

  // ── Step 4: Images (validate → upload → insert; cleans up on failure) ─────
  const imageError = await processLetterContent(letterId, formData);
  if (imageError) return imageError;

  // ── Step 5: Redirect to confirmation page ─────────────────────────────────
  const params = new URLSearchParams({
    handle: senderHandle,
    receiver: receiverName,
    letter: letterName,
  });
  redirect(`/new/created?${params.toString()}`);
}

/**
 * Server action: send a DIRECT letter to an existing phonebook connection.
 *
 * Differs from createLetterAction: the recipient is an existing user (resolved
 * from the hidden `to` handle), the send is gated by `areConnected`, and the
 * letter is permanent — receiver_id is set and claim_token/expires_at are NULL.
 * Shares the body/image pipeline (processLetterContent).
 */
export async function sendDirectLetterAction(
  _prevState: CreateLetterState,
  formData: FormData
): Promise<CreateLetterState> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const profile = await requireProfile();
  const senderId: string = profile.id as string;
  const senderHandle: string = profile.handle as string;

  // ── Validate inputs ─────────────────────────────────────────────────────────
  const to = ((formData.get("to") as string | null) ?? "").trim();
  const rawLetterName = (formData.get("letter_name") as string | null) ?? "";
  const rawBody = (formData.get("body") as string | null) ?? "";

  if (!to) return { error: "Choose someone to write to.", field: "receiver" };
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

  // ── Resolve recipient + authorize (connections only) ───────────────────────
  // The client `to` handle is never trusted: re-resolve it and re-check the
  // connection server-side. A self-send is blocked because you are never your
  // own connection.
  const [recipient] = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(eq(profiles.handle, to))
    .limit(1);

  if (!recipient || !(await areConnected(senderId, recipient.id))) {
    return {
      error: "You can only send a letter to someone you're connected with.",
      field: "receiver",
    };
  }

  const letterName = slugify(rawLetterName);
  const letterId = crypto.randomUUID();

  // ── Insert the direct letter (receiver_id set; no claim/expires) ───────────
  try {
    await db.insert(letters).values({
      id: letterId,
      senderId,
      senderHandle,
      receiverId: recipient.id,
      // receiver_name = recipient handle keeps letters_url_unique meaningful and
      // gives the inbox a label.
      receiverName: recipient.handle,
      letterName,
      body: rawBody.trim(),
      status: "unopened",
    });
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint_name?: string; constraint?: string };
    if (
      pgErr?.code === "23505" &&
      (pgErr?.constraint_name === "letters_url_unique" ||
        pgErr?.constraint === "letters_url_unique")
    ) {
      return {
        error:
          "You've already sent them a letter with that name — choose another.",
        field: "letter",
      };
    }
    throw err;
  }

  // ── Images (shared pipeline) ───────────────────────────────────────────────
  const imageError = await processLetterContent(letterId, formData);
  if (imageError) return imageError;

  redirect("/new/sent");
}
