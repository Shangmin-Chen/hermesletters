"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { createLetterAction, type CreateLetterState } from "./actions";
import { slugify } from "@/lib/slugify";
import {
  bodyOk,
  slugFieldOk,
  secretOk,
  type FieldKey,
} from "@/lib/letter-validation";
import { PaperScene, type SelectedImage } from "./PaperScene";
import { EnvelopeScene } from "./EnvelopeScene";
import { SealScene } from "./SealScene";
import { FoldClone } from "./FoldClone";

interface ComposeLetterProps {
  senderHandle: string;
}

// ── Client-side image guardrails ──────────────────────────────────────────────
// Mirror (loosely) the server's allowlist so we can warn BEFORE submit. The
// server remains the source of truth (magic-byte validation); this is UX only.
const ACCEPTED_EXTENSIONS =
  ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp";
const ACCEPTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
// Generous client-side ceiling — purely to catch obviously-too-large files
// early. The server enforces the real limits.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Draft autosave ────────────────────────────────────────────────────────────
// We persist only non-sensitive fields. The answer is NEVER stored.
const DRAFT_KEY = "send-a-letter:new-draft";

type Draft = {
  receiver_name?: string;
  letter_name?: string;
  body?: string;
  question?: string;
};

// ── Compose steps ─────────────────────────────────────────────────────────────
type Step = "paper" | "address" | "seal";
const STEP_ORDER: Step[] = ["paper", "address", "seal"];

// Map a server error's field discriminator to the step that owns it (T2.4).
const FIELD_TO_STEP: Record<FieldKey, Step> = {
  body: "paper",
  receiver: "address",
  letter: "address",
  question: "seal",
  answer: "seal",
};

// ── Fold gesture tuning ───────────────────────────────────────────────────────
// Above this measured content height we skip the 3-D fold and use the cheap
// shrink-drop fallback (T4.1e). Sub-480px viewports also use the fallback.
const MAX_CLONE_HEIGHT = 900;
const MOBILE_MAX_WIDTH = 480;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (file.type && !ACCEPTED_MIME.has(file.type)) {
    return "Unsupported format — use PNG, JPEG, GIF, or WEBP.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `Too large (${formatBytes(file.size)}) — keep photos under 10 MB.`;
  }
  return null;
}

// Geometry captured from the live textarea so the clone reproduces the page.
type FoldGeometry = {
  text: string;
  totalHeight: number;
  panelHeight: number;
  width: number;
  padX: number;
  padY: number;
};

export function ComposeLetter({ senderHandle }: ComposeLetterProps) {
  const [state, formAction, isPending] = useActionState<
    CreateLetterState,
    FormData
  >(createLetterAction, null);

  // ── Controlled text-field state (all inputs stay mounted; A1) ───────────────
  const [receiverName, setReceiverName] = useState("");
  const [letterName, setLetterName] = useState("");
  const [body, setBody] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("paper");
  const [announcement, setAnnouncement] = useState("");

  // ── Image selection state (owned by the orchestrator; A1) ───────────────────
  const [images, setImages] = useState<SelectedImage[]>([]);

  // ── Fold gesture state ──────────────────────────────────────────────────────
  // `foldGeo` non-null ⇒ the FoldClone is mounted and a fold is in flight.
  const [foldGeo, setFoldGeo] = useState<FoldGeometry | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const restoredRef = useRef(false);

  // Scene heading refs — focus moves here on step change (T2.5).
  const paperHeadingRef = useRef<HTMLHeadingElement>(null);
  const addressHeadingRef = useRef<HTMLHeadingElement>(null);
  const sealHeadingRef = useRef<HTMLHeadingElement>(null);

  // Fold animation targets + bookkeeping.
  const foldStageRef = useRef<HTMLDivElement>(null);
  const topPanelRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const runningAnimsRef = useRef<Animation[]>([]);
  const foldDoneRef = useRef(false); // idempotency guard for the skip/finish chain
  const skipCleanupRef = useRef<(() => void) | null>(null);
  // Saved caret/scroll so an instant Back restores the live textarea exactly.
  const caretRef = useRef<{ start: number; end: number; scrollTop: number }>({
    start: 0,
    end: 0,
    scrollTop: 0,
  });

  // Whether focus should move to the active step's heading after a step change.
  // Set true only on user-driven transitions (not the initial paper mount, so
  // we don't steal focus on page load).
  const focusOnStepRef = useRef(false);

  // ── Shared JS reduced-motion gate (T4.3a) ───────────────────────────────────
  // A CSS media query cannot stop a WAAPI animation, so we consult this in JS.
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ── Auto-grow height sync for the borderless paper textarea (T3.1a) ─────────
  // `field-sizing: content` handles most cases; this JS fallback covers browsers
  // without it and must also fire after a draft restore (long restored drafts
  // should be fully expanded on mount).
  const syncBodyHeight = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // ── Restore draft on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Draft;
      // Restoring a persisted draft is a one-time sync from an external store
      // only readable on the client — it must live in an effect to avoid a
      // hydration mismatch, so the synchronous setState here is intentional.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (draft.receiver_name) setReceiverName(draft.receiver_name);
      if (draft.letter_name) setLetterName(draft.letter_name);
      if (draft.body) setBody(draft.body);
      if (draft.question) setQuestion(draft.question);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Corrupt draft — ignore.
    }
  }, []);

  // Grow the textarea after a restored draft lands (and on body changes).
  useLayoutEffect(() => {
    syncBodyHeight();
  }, [body, syncBodyHeight]);

  // ── Persist draft (debounced) — NEVER includes the answer ───────────────────
  useEffect(() => {
    const hasContent = receiverName || letterName || body || question;
    const timeout = setTimeout(() => {
      try {
        if (!hasContent) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        const draft: Draft = {
          receiver_name: receiverName,
          letter_name: letterName,
          body,
          question,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Storage unavailable (private mode / quota) — autosave is best-effort.
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [receiverName, letterName, body, question]);

  // ── Revoke object URLs when the selection changes or on unmount ─────────────
  // Keyed on the images array ONLY (not step) — scenes show/hide, they don't
  // unmount, so step changes must never revoke a live preview.
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, [images]);

  // ── Error → step routing (T2.4) ─────────────────────────────────────────────
  // On a server error with a field, switch to the owning step FIRST, then focus
  // the banner (so we never focus a node about to be hidden / scroll to hidden).
  useEffect(() => {
    if (!state?.error) return;
    if (state.field) {
      const target = FIELD_TO_STEP[state.field];
      // Switch step without stealing the heading focus — the banner takes focus.
      // This is a sync from an external system (the server action's result) into
      // React state, which is exactly what an effect is for; the lint rule's
      // cascading-render concern doesn't apply to a one-shot error route.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep((prev) => (prev === target ? prev : target));
    }
    // Defer the focus/scroll to after the step switch has committed and the
    // owning scene is visible (no scroll-to-hidden).
    const id = requestAnimationFrame(() => {
      if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        errorRef.current.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [state]);

  // ── Focus the active step's heading on user-driven step changes (T2.5) ──────
  useEffect(() => {
    if (!focusOnStepRef.current) return;
    focusOnStepRef.current = false;
    const ref =
      step === "paper"
        ? paperHeadingRef
        : step === "address"
        ? addressHeadingRef
        : sealHeadingRef;
    ref.current?.focus();
    // Single polite announcement: step number + a short verb that does NOT
    // duplicate the heading text the focus move will read.
    const n = STEP_ORDER.indexOf(step) + 1;
    const verb =
      step === "paper"
        ? "back to your letter"
        : step === "address"
        ? "addressing the envelope"
        : "sealing with a secret";
    setAnnouncement(`Step ${n} of 3 — ${verb}.`);
  }, [step]);

  // ── Image handlers ──────────────────────────────────────────────────────────
  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages(
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        warning: validateFile(file),
      }))
    );
  }

  function clearImages() {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const hasWarnings = images.some((img) => img.warning !== null);

  // ── Step navigation (instant Back, gated Next) ──────────────────────────────
  const goToStep = useCallback((next: Step) => {
    focusOnStepRef.current = true;
    setStep(next);
  }, []);

  // Address → paper: instant Back. Restores the live textarea caret/scroll; the
  // FoldClone (if somehow still mounted) is torn down. No reverse animation.
  const backToPaper = useCallback(() => {
    setFoldGeo(null);
    goToStep("paper");
    // Restore caret/scroll after the paper scene is visible again.
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      try {
        el.setSelectionRange(caretRef.current.start, caretRef.current.end);
      } catch {
        // setSelectionRange can throw on some states — non-fatal.
      }
      el.scrollTop = caretRef.current.scrollTop;
    });
  }, [goToStep]);

  // ── Fold timeline tail: switch scenes, then focus address heading ───────────
  const finishFold = useCallback(() => {
    if (foldDoneRef.current) return; // idempotent (T4.3)
    foldDoneRef.current = true;
    // Remove any skip listeners.
    skipCleanupRef.current?.();
    skipCleanupRef.current = null;
    runningAnimsRef.current = [];
    setFoldGeo(null);
    goToStep("address");
  }, [goToStep]);

  // Skip handler — any tap/keypress finishes all running anims (which fires the
  // deferred finished chain → finishFold once). Ignores Tab/Shift-Tab/modifiers.
  const installSkip = useCallback(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Tab" ||
        e.shiftKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }
      runningAnimsRef.current.forEach((a) => a.finish());
    };
    const onPointer = () => {
      runningAnimsRef.current.forEach((a) => a.finish());
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    const cleanup = () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
    skipCleanupRef.current = cleanup;
    return cleanup;
  }, []);

  // ── Fold trigger (T4.1c + T4.2b + T4.3a + T4.3b) ────────────────────────────
  const startFold = useCallback(() => {
    // Step-gate: paper → address requires a non-empty body (T2.3).
    if (!bodyOk(body)) {
      goToStep("paper");
      bodyRef.current?.focus();
      return;
    }
    if (foldGeo) return; // already folding

    const textarea = bodyRef.current;

    // Focus-park: move focus to the stage container so focus is never inside a
    // node that becomes hidden mid-fold (T4.3b). The stage mounts with the clone;
    // until then park on the body's wrapper via the textarea blur below.
    // Commit any IME composition, then read the committed value on the next rAF.
    textarea?.blur();

    requestAnimationFrame(() => {
      const el = bodyRef.current;
      const committed = el ? el.value : body;

      // Save caret/scroll for an instant Back.
      if (el) {
        caretRef.current = {
          start: el.selectionStart ?? committed.length,
          end: el.selectionEnd ?? committed.length,
          scrollTop: el.scrollTop,
        };
      }

      // Measure geometry from the live textarea content box.
      let width = 320;
      let padX = 16;
      let padY = 12;
      let totalHeight = 0;
      if (el) {
        const cs = getComputedStyle(el);
        padX = parseFloat(cs.paddingLeft) || 16;
        padY = parseFloat(cs.paddingTop) || 12;
        width = el.clientWidth || el.offsetWidth || 320;
        // scrollHeight reflects the full auto-grown content height.
        totalHeight = el.scrollHeight || el.clientHeight || 0;
      }
      const panelHeight = Math.max(1, Math.ceil(totalHeight / 3));

      const viewportW =
        typeof window !== "undefined" ? window.innerWidth : 1024;
      const useFallback =
        reducedMotionRef.current ||
        viewportW <= MOBILE_MAX_WIDTH ||
        totalHeight > MAX_CLONE_HEIGHT ||
        totalHeight === 0;

      if (useFallback) {
        // Skip the WAAPI timeline entirely; jump straight to the address scene.
        // Shares the same finished→setStep→focus tail (T4.3a).
        foldDoneRef.current = false;
        finishFold();
        return;
      }

      // Mount the clone with measured geometry. The WAAPI timeline starts once
      // the stage/panel refs are populated (next layout effect).
      foldDoneRef.current = false;
      setFoldGeo({
        text: committed,
        totalHeight,
        panelHeight,
        width,
        padX,
        padY,
      });
    });
  }, [body, foldGeo, finishFold, goToStep]);

  // Run the WAAPI fold timeline once the clone is mounted (refs populated).
  useLayoutEffect(() => {
    if (!foldGeo) return;
    const stage = foldStageRef.current;
    const top = topPanelRef.current;
    const bottom = bottomPanelRef.current;
    if (!stage || !top || !bottom) return;

    // Park focus on the stage so focus is never inside the paper scene that
    // stays visible-but-static behind the fold (T4.3b).
    stage.tabIndex = -1;
    stage.focus({ preventScroll: true });

    const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
    const foldOpts: KeyframeAnimationOptions = {
      duration: 480,
      easing: EASE,
      fill: "forwards",
    };

    const topAnim = top.animate(
      [{ transform: "rotateX(0deg)" }, { transform: "rotateX(-180deg)" }],
      foldOpts
    );
    const bottomAnim = bottom.animate(
      [{ transform: "rotateX(0deg)" }, { transform: "rotateX(180deg)" }],
      foldOpts
    );

    runningAnimsRef.current = [topAnim, bottomAnim];
    const cleanupSkip = installSkip();

    let cancelled = false;
    (async () => {
      try {
        await Promise.all([topAnim.finished, bottomAnim.finished]);
        if (cancelled) return;
        // Then the tuck, applied to the perspective STAGE ancestor (T-recipe).
        const tuck = stage.animate(
          [
            { transform: "translateY(0) scale(1)", opacity: 1 },
            { transform: "translateY(46px) scale(0.34)", opacity: 0 },
          ],
          { duration: 300, easing: EASE, fill: "forwards" }
        );
        runningAnimsRef.current = [tuck];
        await tuck.finished;
        if (cancelled) return;
        finishFold();
      } catch {
        // .cancel() rejects the finished promise — ignore.
      }
    })();

    return () => {
      cancelled = true;
      cleanupSkip();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foldGeo]);

  // ── Address → seal gate (slugFieldOk × 2; T2.3) ─────────────────────────────
  const addressToSeal = useCallback(() => {
    if (!slugFieldOk(receiverName) || !slugFieldOk(letterName)) {
      return; // server messaging covers the edge; client simply blocks advance
    }
    goToStep("seal");
  }, [receiverName, letterName, goToStep]);

  // ── Live URL preview (server-parity slugify) ────────────────────────────────
  const receiverSlug = slugify(receiverName);
  const letterSlug = slugify(letterName);
  const urlPreview = (
    <>
      {`/${senderHandle}/`}
      {receiverSlug || (
        <span className="text-muted-foreground/60">their-name</span>
      )}
      {"/"}
      {letterSlug || (
        <span className="text-muted-foreground/60">letter-name</span>
      )}
    </>
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Client step-gate: seal → submit requires a non-empty question+answer
        // (T2.3). Block the submit and keep the user on the seal step rather than
        // round-tripping to the server for a blank-field error. The server still
        // validates authoritatively for anything we miss.
        if (!secretOk(question, answer)) {
          e.preventDefault();
          goToStep("seal");
          return;
        }
        // Optimistically clear the draft — controlled values stay in state, so a
        // returned error loses nothing and the autosave effect re-persists them.
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
      }}
      className="space-y-6"
    >
      {/* Single polite live region for step announcements (T2.5). */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {/* Error banner */}
      {state?.error && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none"
        >
          {state.error}
        </div>
      )}

      {/* ── Scene 1: Paper ── */}
      <section
        hidden={step !== "paper"}
        role="group"
        aria-labelledby="step-paper-heading"
      >
        <h2
          id="step-paper-heading"
          ref={paperHeadingRef}
          tabIndex={-1}
          className="mb-5 border-b border-border pb-2 font-serif text-base font-semibold text-ink outline-none"
        >
          Your letter
        </h2>

        {/* The paper scene; while folding, the static clone overlays it. */}
        <div className="relative">
          <div
            // Hide the live paper visually during the fold but keep it mounted
            // (focus already parked on the stage). It stays visible until the
            // tuck finishes, so there's no flash of empty space.
            className={foldGeo ? "pointer-events-none opacity-0" : ""}
          >
            <PaperScene
              body={body}
              onBodyChange={(v) => {
                setBody(v);
                syncBodyHeight();
              }}
              bodyRef={bodyRef}
              fileInputRef={fileInputRef}
              acceptedExtensions={ACCEPTED_EXTENSIONS}
              onFilesChange={handleFilesChange}
              images={images}
              onClearImages={clearImages}
              hasWarnings={hasWarnings}
              onFold={startFold}
              isPending={isPending}
            />
          </div>

          {foldGeo && (
            <div className="absolute inset-0 flex justify-center">
              <FoldClone
                ref={foldStageRef}
                text={foldGeo.text}
                totalHeight={foldGeo.totalHeight}
                panelHeight={foldGeo.panelHeight}
                width={foldGeo.width}
                padX={foldGeo.padX}
                padY={foldGeo.padY}
                topPanelRef={topPanelRef}
                bottomPanelRef={bottomPanelRef}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Scene 2: Address ── */}
      <section
        hidden={step !== "address"}
        role="group"
        aria-labelledby="step-address-heading"
      >
        <h2
          id="step-address-heading"
          ref={addressHeadingRef}
          tabIndex={-1}
          className="mb-5 border-b border-border pb-2 font-serif text-base font-semibold text-ink outline-none"
        >
          Address the envelope
        </h2>
        <EnvelopeScene
          senderHandle={senderHandle}
          receiverName={receiverName}
          onReceiverNameChange={setReceiverName}
          letterName={letterName}
          onLetterNameChange={setLetterName}
          urlPreview={urlPreview}
          onBack={backToPaper}
          onNext={addressToSeal}
          isPending={isPending}
        />
      </section>

      {/* ── Scene 3: Seal ── */}
      <section
        hidden={step !== "seal"}
        role="group"
        aria-labelledby="step-seal-heading"
      >
        <h2
          id="step-seal-heading"
          ref={sealHeadingRef}
          tabIndex={-1}
          className="mb-5 border-b border-border pb-2 font-serif text-base font-semibold text-ink outline-none"
        >
          Seal it with a secret
        </h2>
        <SealScene
          question={question}
          onQuestionChange={setQuestion}
          answer={answer}
          onAnswerChange={setAnswer}
          showAnswer={showAnswer}
          onToggleShowAnswer={() => setShowAnswer((v) => !v)}
          receiverName={receiverName}
          letterName={letterName}
          body={body}
          onBack={() => goToStep("address")}
          isPending={isPending}
        />
      </section>
    </form>
  );
}
