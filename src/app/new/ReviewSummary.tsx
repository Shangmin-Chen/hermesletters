/**
 * ReviewSummary — a compact, read-only recap of everything entered so far,
 * shown above "Seal & send" on the seal scene (T3.3 / T3.4).
 *
 * It is also the reduced-motion "see everything before sealing" affordance: when
 * motion is off, the ritual collapses to instant transitions and this summary is
 * the user's one-glance reviewability (matching the old single-form's reviewable
 * layout). Body is rendered as escaped plain text with `whitespace-pre-wrap`
 * (never dangerouslySetInnerHTML).
 *
 * Purely presentational — it owns no inputs and no state.
 */
interface ReviewSummaryProps {
  receiverName: string;
  letterName: string;
  body: string;
  question: string;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

export function ReviewSummary({
  receiverName,
  letterName,
  body,
  question,
}: ReviewSummaryProps) {
  return (
    <section
      aria-label="Review your letter before sealing"
      className="rounded-xl border border-border bg-muted/40 px-4 py-4 space-y-4"
    >
      <p className="font-serif text-sm font-semibold text-ink">
        Before you seal it
      </p>

      <Field label="To">
        <p className="text-sm text-ink break-words">
          {receiverName || (
            <span className="text-muted-foreground/70">— not set —</span>
          )}
        </p>
      </Field>

      <Field label="Label">
        <p className="text-sm text-ink break-words">
          {letterName || (
            <span className="text-muted-foreground/70">— not set —</span>
          )}
        </p>
      </Field>

      <Field label="Your letter">
        {body.trim() ? (
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink">
            {body}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/70">— empty —</p>
        )}
      </Field>

      <Field label="Their question">
        <p className="text-sm text-ink break-words">
          {question || (
            <span className="text-muted-foreground/70">— not set —</span>
          )}
        </p>
      </Field>
    </section>
  );
}
