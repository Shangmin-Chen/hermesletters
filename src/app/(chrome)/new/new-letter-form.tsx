"use client";

import type React from "react";
import {
  useActionState,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  createLetterAction,
  sendDirectLetterAction,
  type CreateLetterState,
} from "./actions";
import { slugify } from "@/lib/slugify";
import {
  secretPromptOk,
  secretAnswerOk,
  type FieldKey,
} from "@/lib/letter-validation";
import { compressImage } from "@/lib/image-compression";
import {
  MAX_IMAGE_BYTES,
  MAX_LETTER_IMAGES,
  MAX_TOTAL_IMAGE_BYTES,
  formatMegabytes,
} from "@/lib/image-policy";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LockOpen,
  X,
} from "lucide-react";
import { useLongPress, usePress } from "@react-aria/interactions";
import { mergeProps } from "@react-aria/utils";
import { Envelope } from "@/components/brand/Envelope";
import { SealMark } from "@/components/brand/SealMark";

interface NewLetterFormProps {
  senderHandle: string;
  /**
   * When set, the form is in DIRECT mode: it sends to this existing connection
   * (server-validated) instead of an invite. The free-text receiver field and
   * URL preview are replaced with a locked recipient, and it submits to
   * sendDirectLetterAction.
   */
  directRecipient?: { handle: string; displayName: string | null };
}

interface ImagePreview {
  file: File;
  objectUrl: string;
  sourceKey: string;
  caption: string;
}

// Each step lists the required field names to validate before advancing.
const STEPS = [
  { label: "Write", fields: ["body"] },
  { label: "Photos", fields: [] },
  { label: "Seal", fields: [] },
  { label: "Send", fields: ["receiver_name", "letter_name"] },
] as const;

const LAST_STEP = STEPS.length - 1;

// Maps a server-side field error back to the wizard step that owns that field,
// so a rejected submit lands the user on the step where they can fix it.
const FIELD_TO_STEP: Record<FieldKey, number> = {
  body: 0,
  images: 1,
  receiver: LAST_STEP,
  letter: LAST_STEP,
  // The shared secret now lives on the Seal step (step index 2).
  secret: 2,
};

function imageDedupeKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

// How long (ms) the user must hold the wax seal to commit.
const SEAL_HOLD_MS = 750;

// Format a Date as e.g. "Jun 16"
function formatSealDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── WaxSeal Component ────────────────────────────────────────────────────────
//
// v4 (press-down stamp): The wax seal already rests on the flap of a closed
// <Envelope> — like wax that's been dripped but not yet pressed. The seal itself
// is the press target, wrapped in a charging ring that fills as you hold. On
// commit the seal *presses straight down* into the flap (a brief squash via
// animate-seal-press) while an impact ripple radiates out — like pushing a
// signet down with your thumb. No travel, no clone: it stamps where it sits.
//
// Dual-path gesture (WCAG 2.5.1 — Pointer Gestures):
//   • useLongPress  → hold SEAL_HOLD_MS ms to commit
//   • usePress.onPress → keyboard Enter/Space OR assistive activate commits now
// Both paths are always available; the hold just shows the charging feedback.
//
// Re-entry: if the caller sets `sealed=true` (parent navigated Back), the seal
// is shown resting on the flap with a "Break seal to edit" button.

interface WaxSealProps {
  disabled: boolean;
  /** Controlled sealed state — allows the parent to drive re-entry. */
  sealed: boolean;
  /** Message shown (status + aria-label) while disabled, e.g. why sealing is blocked. */
  disabledHint?: string;
  onSeal: () => void;
  onBreakSeal: () => void;
}

// Geometry for the seal sitting on the flap and its charging ring.
// SealMark is rendered `tight`, so these sizes ≈ the seal's visible diameter.
const REST_SEAL = 48; // px — interactive seal diameter
const RING_BOX = 60; // px — charging-ring viewport (seal + a hair of breathing room)
const RING_R = 27; // ring radius within the box — hugs the seal (~3px gap)
const RING_C = 2 * Math.PI * RING_R; // circumference for dash math

// How long (ms) the press-down stamp animation runs before onSeal fires. Matches
// the seal-press keyframe duration in globals.css (0.45s).
const STAMP_MS = 450;

export function WaxSeal({ disabled, sealed, disabledHint, onSeal, onBreakSeal }: WaxSealProps) {
  const [progress, setProgress] = useState(0); // 0–1 while held
  const [pressing, setPressing] = useState(false); // true while pointer is down
  const [stamping, setStamping] = useState(false); // press-down animation playing
  const pressStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  // Tracks whether a commit is in progress so onPressEnd doesn't drain progress.
  const committingRef = useRef(false);
  // Holds the pending commit timer so break/unmount can cancel it before it
  // fires a stray onSeal().
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Respect prefers-reduced-motion.
  const prefersReduced =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // Tick progress while held — drives the charging ring + scale/glow feedback.
  const startProgress = useCallback(() => {
    if (disabled || sealed) return;
    pressStartRef.current = performance.now();
    setPressing(true);

    const tick = () => {
      if (pressStartRef.current === null) return;
      const elapsed = performance.now() - pressStartRef.current;
      const p = Math.min(elapsed / SEAL_HOLD_MS, 1);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (prefersReduced) {
      // Skip animation — commit immediately on press (handled by usePress).
      setProgress(1);
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [disabled, sealed, prefersReduced]);

  const cancelProgress = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pressStartRef.current = null;
    setPressing(false);
    if (!sealed) setProgress(0);
  }, [sealed]);

  const commitSeal = useCallback(() => {
    if (disabled || sealed || committingRef.current) return;
    committingRef.current = true;
    cancelProgress();
    setProgress(1);

    // Reduced motion: skip the stamp animation, seal instantly.
    if (prefersReduced) {
      committingRef.current = false;
      onSeal();
      return;
    }

    // Play the press-down squash + impact ripple in place, then commit.
    setStamping(true);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      committingRef.current = false;
      onSeal();
    }, STAMP_MS);
  }, [disabled, sealed, prefersReduced, cancelProgress, onSeal]);

  // useLongPress owns the hold-to-commit gesture; accessibilityDescription
  // tells screen-reader users the gesture exists (WCAG 2.5.1 advisory).
  const { longPressProps } = useLongPress({
    threshold: SEAL_HOLD_MS,
    accessibilityDescription: "Press and hold to seal the letter",
    onLongPress: commitSeal,
    // onLongPressEnd fires when the pointer lifts before the threshold; drain.
    onLongPressEnd() {
      if (!sealed && !committingRef.current) cancelProgress();
    },
  });

  // usePress kicks off the charging ring and handles activation. For a POINTER
  // (mouse/touch) the seal must be *held until the ring completes* — that commit
  // comes from useLongPress at SEAL_HOLD_MS; a short tap only fills the ring part
  // way and then drains back on release (onPressEnd). Keyboard / assistive-tech
  // activation can't "hold", so it commits immediately (WCAG 2.5.1), as does
  // reduced-motion where there's no charging animation to watch.
  const { pressProps } = usePress({
    isDisabled: disabled || sealed,
    onPressStart() {
      startProgress();
    },
    onPressEnd() {
      // Drain on early release, not when a commit already fired.
      if (!sealed && !committingRef.current) cancelProgress();
    },
    onPress(e) {
      if (e.pointerType === "keyboard" || e.pointerType === "virtual" || prefersReduced) {
        commitSeal();
      }
      // Pointer holds are committed by onLongPress once the ring is full.
    },
  });

  // Clean up rAF + pending commit timer on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (commitTimerRef.current !== null) clearTimeout(commitTimerRef.current);
    };
  }, []);

  // Breaking the seal resets all local animation state back to resting. The
  // step sections are toggled with `hidden` (never unmounted), so this
  // component keeps its state across seal/break cycles — without this reset,
  // the seal would stay stuck mid-stamp with a full charging ring.
  const handleBreak = useCallback(() => {
    committingRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    pressStartRef.current = null;
    setStamping(false);
    setPressing(false);
    setProgress(0);
    onBreakSeal();
  }, [onBreakSeal]);

  const sealDate = formatSealDate(new Date());

  // Resting-seal visual state: scales up + glows as the hold progresses.
  const sealScale = pressing ? 1 + progress * 0.18 : 1; // 1.0 → 1.18
  const sealOpacity = pressing ? 0.6 + progress * 0.4 : 1; // 0.6 → 1.0
  const glow = pressing ? progress : 0;

  return (
    <div className="relative flex flex-col items-center gap-6">
      {/* ── Closed envelope — the wax seal rests right on its flap ───────── */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        <Envelope
          state="sealed"
          showSeal={false}
          className="w-32 h-32 text-ink drop-shadow-[0_6px_16px_oklch(0_0_0/0.14)]"
          aria-hidden
        />

        {/* The wax seal sitting on the flap — also the press target. Centered
            over the flap fold, wrapped in its charging ring. */}
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "59%",
            transform: "translate(-50%, -50%)",
            width: REST_SEAL,
            height: REST_SEAL,
          }}
        >
          <div
            className="relative"
            style={{ width: RING_BOX, height: RING_BOX, margin: "auto", transform: "translate(-6px, -6px)" }}
          >
            {/* Impact ripple — radiates the instant the seal presses down. */}
            {stamping && !prefersReduced && (
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-wax animate-seal-impact"
                style={{ width: REST_SEAL, height: REST_SEAL }}
                aria-hidden
              />
            )}

            {/* Charging ring — track + progress arc, sweeping from the top. */}
            <svg
              className="absolute inset-0 -rotate-90"
              viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
              aria-hidden
            >
              <circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_R}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2}
              />
              <circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_R}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - progress)}
                style={{
                  transition:
                    pressing || prefersReduced
                      ? "none"
                      : "stroke-dashoffset 0.3s ease",
                  opacity: progress > 0 ? 1 : 0,
                }}
              />
            </svg>

            {/* Stamp button: the SealMark is the press target, centered in the
                ring. It scales + glows as the hold progresses (wax pressing). */}
            <button
              {...mergeProps(longPressProps, pressProps)}
              type="button"
              aria-label={
                disabled
                  ? disabledHint ?? "Write your letter first to seal it"
                  : sealed
                    ? "Letter sealed"
                    : "Press and hold to seal the letter"
              }
              disabled={disabled || sealed}
              aria-disabled={disabled || sealed}
              /* Centering is done entirely via the inline `transform` below.
                 Tailwind v4's `-translate-*` utilities compile to the separate
                 `translate:` property, which would stack with the inline
                 transform and double-shift the seal off the ring. */
              className={[
                "absolute left-1/2 top-1/2",
                "select-none rounded-full",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-offset-2",
                disabled || sealed ? "cursor-default" : "cursor-pointer",
                disabled ? "opacity-40" : "",
              ].join(" ")}
              style={
                !prefersReduced
                  ? {
                      transform: `translate(-50%, -50%) scale(${sealScale})`,
                      opacity: sealOpacity,
                      filter: glow
                        ? `drop-shadow(0 ${2 + glow * 5}px ${6 + glow * 14}px oklch(0 0 0 / ${0.12 + glow * 0.28}))`
                        : undefined,
                      transition: pressing
                        ? "none" // live rAF control during hold
                        : "transform 0.25s ease, opacity 0.25s ease, filter 0.25s ease",
                    }
                  : { transform: "translate(-50%, -50%)" }
              }
            >
              <SealMark
                size={REST_SEAL}
                tight
                groupClassName={
                  stamping && !prefersReduced
                    ? "animate-seal-press"
                    : !disabled && !sealed && !pressing && !prefersReduced
                      ? "animate-wax-pulse"
                      : ""
                }
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>

      {sealed ? (
        /* ── Sealed state: date + break-seal affordance (seal sits on flap) ── */
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-ink">Sealed · {sealDate}</p>
          <button
            type="button"
            onClick={handleBreak}
            className={[
              "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
              "underline underline-offset-2 hover:text-ink transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "focus-visible:ring-offset-2 rounded",
            ].join(" ")}
          >
            <LockOpen className="size-3" aria-hidden />
            Break seal to edit
          </button>
        </div>
      ) : (
        /* Status label — fixed width so changing copy can't resize the
            container at the moment of commit. */
        <p
          className="w-56 text-sm text-center text-muted-foreground min-h-[1.25rem]"
          aria-live="polite"
        >
          {disabled
            ? disabledHint ?? "Write your letter first"
            : stamping
              ? "Sealing…"
              : progress > 0 && progress < 1
                ? "Keep holding…"
                : "Press and hold to seal"}
        </p>
      )}
    </div>
  );
}

// ── Main form ───────────────────────────────────────────────────────────────

export function NewLetterForm({
  senderHandle,
  directRecipient,
}: NewLetterFormProps) {
  const isDirect = Boolean(directRecipient);
  const [state, formAction, isPending] = useActionState<
    CreateLetterState,
    FormData
  >(isDirect ? sendDirectLetterAction : createLetterAction, null);
  const [step, setStep] = useState(0);
  const [receiverName, setReceiverName] = useState("");
  const [letterName, setLetterName] = useState("");
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [directSecretEnabled, setDirectSecretEnabled] = useState(false);
  // Controlled secret fields — needed so the Seal step can gate the wax seal on
  // a valid shared secret before it can be stamped.
  const [secretPrompt, setSecretPrompt] = useState("");
  const [secretAnswer, setSecretAnswer] = useState("");
  // Whether the letter has been sealed. Separate from step so navigating Back
  // into step 2 remembers the prior seal and shows the re-entry affordance.
  const [isSealed, setIsSealed] = useState(false);

  // The secret is required for invite letters, and for direct letters only when
  // the sender opts in. When required, both prompt and answer must be valid
  // before the seal can be pressed.
  const secretRequired = !isDirect || directSecretEnabled;
  const secretReady =
    !secretRequired ||
    (secretPromptOk(secretPrompt) && secretAnswerOk(secretAnswer));

  const router = useRouter();

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref for the receiver-name field so we can focus it after sealing.
  const receiverNameRef = useRef<HTMLInputElement>(null);

  const receiverSlug = slugify(receiverName);
  const letterSlug = slugify(letterName);

  // Write a list of previews back to the underlying file input so the form
  // submits exactly what's shown.
  const syncInput = useCallback((previews: ImagePreview[]) => {
    const input = fileInputRef.current;
    if (!input) return;
    if (previews.length === 0 && input.files?.length === 0) return;
    if (typeof DataTransfer === "undefined") return;

    try {
      const dt = new DataTransfer();
      previews.forEach((p) => dt.items.add(p.file));
      input.files = dt.files;
    } catch (err) {
      console.error("Failed to sync selected images to the form input:", err);
    }
  }, []);

  const previewsRef = useRef<ImagePreview[]>(imagePreviews);
  const createdUrlsRef = useRef<Set<string>>(new Set());

  // Keep the async add path and hidden file input aligned with rendered state.
  useEffect(() => {
    previewsRef.current = imagePreviews;
    syncInput(imagePreviews);
  }, [imagePreviews, syncInput]);

  // Revoke URLs that were created but did not survive the final state update.
  useEffect(() => {
    const activeUrls = new Set(imagePreviews.map((p) => p.objectUrl));
    createdUrlsRef.current.forEach((url) => {
      if (!activeUrls.has(url)) {
        URL.revokeObjectURL(url);
        createdUrlsRef.current.delete(url);
      }
    });
  }, [imagePreviews]);

  // Clean up any remaining preview URLs on unmount.
  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      urls.clear();
    };
  }, []);

  // Append image files (from browse or drag-and-drop) to the current list,
  // compressing them and skipping non-images and duplicates.
  const addFiles = useCallback(
    async (incoming: File[]) => {
      const images = incoming.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;

      const existing = new Set(previewsRef.current.map((p) => p.sourceKey));
      const candidates: { file: File; sourceKey: string }[] = [];
      for (const file of images) {
        const sourceKey = imageDedupeKey(file);
        if (!existing.has(sourceKey)) {
          existing.add(sourceKey);
          candidates.push({ file, sourceKey });
        }
      }

      if (candidates.length === 0) return;

      const remainingSlots = MAX_LETTER_IMAGES - previewsRef.current.length;
      if (remainingSlots <= 0) {
        setImageError(`You can attach up to ${MAX_LETTER_IMAGES} images.`);
        return;
      }

      let filesToProcess = candidates;
      if (candidates.length > remainingSlots) {
        filesToProcess = candidates.slice(0, remainingSlots);
        setImageError(`Only ${MAX_LETTER_IMAGES} images can be attached.`);
      } else {
        setImageError(null);
      }

      const additions: ImagePreview[] = [];
      let totalBytes = previewsRef.current.reduce(
        (sum, preview) => sum + preview.file.size,
        0
      );
      // Keep this serial so a large multi-select does not spike CPU/memory.
      for (const { file, sourceKey } of filesToProcess) {
        let previewFile = file;
        try {
          previewFile = await compressImage(file);
        } catch (err) {
          console.error("Failed to compress image, using original file:", err);
        }

        if (previewFile.size > MAX_IMAGE_BYTES) {
          setImageError(
            `"${file.name}" is still larger than ${formatMegabytes(MAX_IMAGE_BYTES)} MB after compression.`
          );
          continue;
        }

        if (totalBytes + previewFile.size > MAX_TOTAL_IMAGE_BYTES) {
          setImageError(
            `Images must be ${formatMegabytes(MAX_TOTAL_IMAGE_BYTES)} MB total or less after compression.`
          );
          break;
        }

        const url = URL.createObjectURL(previewFile);
        createdUrlsRef.current.add(url);
        totalBytes += previewFile.size;
        additions.push({
          file: previewFile,
          objectUrl: url,
          sourceKey,
          caption: "",
        });
      }

      if (additions.length === 0) return;

      setImagePreviews((prev) => {
        const existingPrev = new Set(prev.map((p) => p.sourceKey));

        const verified: ImagePreview[] = [];
        for (const addition of additions) {
          if (!existingPrev.has(addition.sourceKey)) {
            existingPrev.add(addition.sourceKey);
            verified.push(addition);
          } else {
            URL.revokeObjectURL(addition.objectUrl);
            createdUrlsRef.current.delete(addition.objectUrl);
          }
        }

        if (verified.length === 0) return prev;

        return [...prev, ...verified];
      });
    },
    []
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files ?? []));
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const removeImage = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    createdUrlsRef.current.delete(url);
    setImageError(null);
    setImagePreviews((prev) => prev.filter((p) => p.objectUrl !== url));
  }, []);

  const updateCaption = useCallback(
    (url: string, value: string) => {
      setImagePreviews((prev) =>
        prev.map((preview) =>
          preview.objectUrl === url ? { ...preview, caption: value } : preview
        )
      );
    },
    []
  );

  // Run native validation on the current step's required fields before
  // advancing; surfaces the browser's message on the first invalid one.
  const validateStep = useCallback((s: number) => {
    const form = formRef.current;
    if (!form) return true;
    // The shared secret lives on the Seal step (step 2); validate it there when
    // required (invite letters always, direct letters only when opted in).
    const stepFields =
      s === 2 && (!isDirect || directSecretEnabled)
        ? [...STEPS[s].fields, "secret_prompt", "secret_answer"]
        : [...STEPS[s].fields];
    for (const name of stepFields) {
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (el && !el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    return true;
  }, [directSecretEnabled, isDirect]);

  const goNext = useCallback(() => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, LAST_STEP));
  }, [step, validateStep]);

  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  // Guard the final submit. The form sets `noValidate`, so the browser does NOT
  // run constraint validation across every field on submit — which is what we
  // want: the earlier steps' required fields live in `hidden` sections, and the
  // browser cannot focus a hidden invalid control, so it would abort the submit
  // with a console-only "An invalid form control is not focusable" and no UI.
  // Each step was already gated by validateStep as the user advanced; here we
  // re-check only the final step's visible fields before letting the action run.
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      if (!validateStep(LAST_STEP)) e.preventDefault();
    },
    [validateStep]
  );

  // Called by WaxSeal when the gesture completes — advances to the Send step
  // and moves focus to the receiver-name field.
  const handleSeal = useCallback(() => {
    setIsSealed(true);
    setStep((s) => {
      const next = Math.min(s + 1, LAST_STEP);
      return next;
    });
    // Focus receiver-name field after the step transition. We use a short
    // setTimeout so the DOM is updated before we try to focus — the hidden
    // section's display:none means the ref target is off-screen until the
    // step state updates and React re-renders.
    setTimeout(() => {
      receiverNameRef.current?.focus();
    }, 50);
  }, []);

  // Breaking the seal lets the user re-seal.
  const handleBreakSeal = useCallback(() => {
    setIsSealed(false);
  }, []);

  // When the server rejects a submit with a field-tagged error, jump to the
  // step that owns the offending field so the banner shows in context. This is
  // the React "adjust state during render" pattern (guarded by the previous
  // action result) — preferred over an effect, which would cascade a render.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.error && state.field) {
      setStep(FIELD_TO_STEP[state.field]);
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {/* ── Stepper ─────────────────────────────────────────────────────── */}
      <ol className="flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => {
          const isDone = i < step;
          const isCurrent = i === step;
          return (
            <li key={s.label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  isDone
                    ? "border-ink bg-ink text-background"
                    : isCurrent
                      ? "border-ink text-ink"
                      : "border-border text-muted-foreground"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isDone ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={`hidden text-sm sm:inline ${
                  isCurrent ? "font-medium text-ink" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {i < LAST_STEP && (
                <span className="h-px flex-1 bg-border" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {/* ── Step 1: Write ───────────────────────────────────────────────── */}
      <section
        aria-label="Letter body"
        hidden={step !== 0}
        className="rounded-xl border border-border overflow-hidden shadow-sm"
      >
        <div className="bg-muted/50 border-b border-border px-5 py-3">
          <h2 className="font-serif text-base font-semibold text-ink">
            Your letter
          </h2>
        </div>
        <div className="bg-paper">
          <Label htmlFor="body" className="sr-only">
            Letter body
          </Label>
          <textarea
            id="body"
            name="body"
            placeholder="Dear Jane,&#10;&#10;Write your letter here..."
            required
            disabled={isPending}
            rows={16}
            className="
              w-full resize-none bg-transparent px-6 py-5
              font-serif text-base leading-[1.85] text-ink tracking-[0.01em]
              placeholder:text-muted-foreground/50
              focus:outline-none
              disabled:opacity-60
            "
            style={{ minHeight: "20rem" }}
          />
        </div>
      </section>

      {/* ── Step 2: Photos ──────────────────────────────────────────────── */}
      <section
        aria-label="Photos"
        hidden={step !== 1}
        className="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <div>
          <h2 className="font-serif text-base font-semibold text-ink">
            Add photos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to {MAX_LETTER_IMAGES} images. Large images may be compressed
            before sending. Each image must be {formatMegabytes(MAX_IMAGE_BYTES)} MB
            or less after compression, {formatMegabytes(MAX_TOTAL_IMAGE_BYTES)} MB
            total.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isPending) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={isPending ? undefined : handleDrop}
          onClick={() => !isPending && fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-10 text-center transition-colors ${
            isDragging
              ? "border-ring bg-muted/60"
              : "border-border hover:bg-muted/40"
          } ${isPending ? "pointer-events-none opacity-60" : ""}`}
        >
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-foreground">
            <span className="font-medium">Drag &amp; drop</span> images here, or{" "}
            <span className="underline">browse</span>
          </p>
        </div>

        <Input
          ref={fileInputRef}
          id="images"
          name="images"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp"
          disabled={isPending}
          onChange={handleFileChange}
          className="sr-only"
        />

        {imageError && (
          <p role="alert" className="text-sm text-destructive">
            {imageError}
          </p>
        )}

        {/* Thumbnail previews */}
        {imagePreviews.length > 0 && (
          <ul
            className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            aria-label="Selected images"
          >
            {imagePreviews.map((preview) => (
              <li
                key={preview.objectUrl}
                className="relative group flex flex-col gap-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.objectUrl}
                  alt={preview.file.name}
                  className="h-20 w-full rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(preview.objectUrl)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-destructive shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity"
                  aria-label={`Remove ${preview.file.name}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
                <input
                  type="text"
                  value={preview.caption}
                  onChange={(e) =>
                    updateCaption(preview.objectUrl, e.target.value)
                  }
                  placeholder="Add a caption (optional)"
                  maxLength={200}
                  disabled={isPending}
                  aria-label={`Caption for ${preview.file.name}`}
                  className="w-full rounded border border-border bg-transparent px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                />
              </li>
            ))}
          </ul>
        )}

        {/* Hidden caption inputs — one per preview, in the same order as the
            file input, so formData.getAll("caption")[i] aligns with
            formData.getAll("images")[i] on the server. */}
        {imagePreviews.map((preview, i) => (
          <input
            key={`caption-${i}-${preview.objectUrl}`}
            type="hidden"
            name="caption"
            value={preview.caption}
          />
        ))}
      </section>

      {/* ── Step 3: Seal the letter ─────────────────────────────────────── */}
      {/*  Paper texture behind the card — tasteful, low-opacity, doesn't
          obscure text. The texture is a CSS background on the section itself
          so it scopes cleanly to this step only. */}
      <section
        aria-label="Seal"
        hidden={step !== 2}
        className="rounded-xl border border-border bg-card p-5 space-y-6 relative overflow-hidden"
        style={{
          backgroundImage: "url('/textures/cream-paper.png')",
          backgroundSize: "cover",
          backgroundBlendMode: "multiply",
        }}
      >
        {/* White base layer so the texture stays subtle and text stays readable */}
        <div
          className="absolute inset-0 bg-card/92 pointer-events-none"
          aria-hidden
        />

        {/* All content is above the texture overlay */}
        <div className="relative space-y-6">
          <div>
            <h2 className="font-serif text-base font-semibold text-ink">
              Seal your letter
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Set the shared secret that opens it, then press and hold the wax
              seal to close your letter.
            </p>
          </div>

          {/* Direct mode: choose whether the seal needs a shared secret. */}
          {isDirect && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
              <div>
                <h3 className="font-serif text-base font-semibold text-ink">
                  Choose how the seal opens
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  It can open from their inbox, or you can add a shared secret
                  for a more personal seal.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-md border border-border bg-background/60 px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  name="direct_secret_enabled"
                  value="on"
                  checked={directSecretEnabled}
                  onChange={(event) => setDirectSecretEnabled(event.target.checked)}
                  disabled={isPending}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-foreground">
                    Add a shared secret
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Make them answer a private prompt before the seal opens.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Shared secret — what the seal opens with. Required for invite
              letters; optional (opt-in) for direct letters. */}
          {secretRequired && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
              <div>
                <h3 className="font-serif text-base font-semibold text-ink">
                  Shared secret
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask something only this person would recognize. They will
                  answer it before the seal opens.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="secret_prompt">Private prompt</Label>
                <Input
                  id="secret_prompt"
                  name="secret_prompt"
                  placeholder="e.g. What did we call the blue house?"
                  value={secretPrompt}
                  onChange={(event) => setSecretPrompt(event.target.value)}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="secret_answer">Answer</Label>
                <PasswordInput
                  id="secret_answer"
                  name="secret_answer"
                  placeholder="e.g. moonhouse"
                  value={secretAnswer}
                  onChange={(event) => setSecretAnswer(event.target.value)}
                  required
                  disabled={isPending}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Case-insensitive. Hermes stores a protected hash, not the
                  answer.
                </p>
              </div>
            </div>
          )}

          {/* Ceremonial wax seal — gated until the shared secret is ready. */}
          <div className="flex flex-col items-center py-4">
            <WaxSeal
              disabled={isPending || !secretReady}
              disabledHint={
                !secretReady ? "Add your shared secret to seal" : undefined
              }
              sealed={isSealed}
              onSeal={handleSeal}
              onBreakSeal={handleBreakSeal}
            />
          </div>
        </div>
      </section>

      {/* ── Step 4: Address & send ──────────────────────────────────────── */}
      <section
        aria-label="Address"
        hidden={step !== LAST_STEP}
        className="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <h2 className="font-serif text-base font-semibold text-ink">
          Address &amp; send
        </h2>

        {isDirect ? (
          // Direct mode: recipient is locked to the chosen connection.
          <div className="space-y-1.5">
            <Label>To</Label>
            <div className="rounded-md border border-border bg-muted px-4 py-3">
              <p className="font-medium">@{directRecipient!.handle}</p>
              {directRecipient!.displayName && (
                <p className="text-sm text-muted-foreground">
                  {directRecipient!.displayName}
                </p>
              )}
            </div>
            <input type="hidden" name="to" value={directRecipient!.handle} />
            <p className="text-xs text-muted-foreground">
              This letter lands sealed in their inbox — no link to share.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="receiver_name">Receiver name</Label>
            <Input
              ref={receiverNameRef}
              id="receiver_name"
              name="receiver_name"
              placeholder="e.g. Jane"
              value={receiverName}
              onChange={(event) => setReceiverName(event.target.value)}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Who is this letter for? This becomes part of the URL.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="letter_name">Letter name</Label>
          <Input
            id="letter_name"
            name="letter_name"
            placeholder="e.g. Summer 2025"
            value={letterName}
            onChange={(event) => setLetterName(event.target.value)}
            required
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            A short name for this letter. This also becomes part of the URL.
          </p>
        </div>

        {!isDirect && (
          <div className="rounded-md bg-muted px-4 py-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Your letter URL will be:
            </p>
            <p id="url-preview" className="break-all font-mono text-sm">
              /{senderHandle}/{receiverSlug || "<receiver>"}/
              {letterSlug || "<letter>"}
            </p>
          </div>
        )}
      </section>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={step === 0 ? () => router.push("/dashboard") : goBack}
          disabled={isPending}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {step === 0 ? "Back to dashboard" : "Back"}
        </Button>

        {/* Step 3 (index 2) uses the wax seal gesture instead of a Next button.
            The seal itself calls handleSeal → advances when held. */}
        {step < LAST_STEP && step !== 2 ? (
          <Button type="button" onClick={goNext} disabled={isPending}>
            Next
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : step === LAST_STEP ? (
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Sealing your letter…" : "Send letter"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
