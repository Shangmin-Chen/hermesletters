"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardingAction } from "./actions";
import { slugify } from "@/lib/slugify";

interface OnboardingFormProps {
  emailLocalPart: string;
  next?: string | null;
}

export function OnboardingForm({ emailLocalPart, next }: OnboardingFormProps) {
  const [state, formAction, pending] = useActionState(onboardingAction, null);
  const [handlePreview, setHandlePreview] = useState("");

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8">
      <form action={formAction} className="space-y-5" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

        {state?.error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="handle" className="text-sm font-medium text-foreground">
            Your handle
          </Label>
          <Input
            id="handle"
            name="handle"
            type="text"
            placeholder="e.g. maya"
            required
            autoComplete="off"
            className="focus-visible:ring-ring transition-shadow"
            aria-describedby="handle-hint"
            onChange={(e) => setHandlePreview(slugify(e.target.value))}
          />
          {handlePreview ? (
            <p id="handle-hint" className="text-xs text-muted-foreground" aria-live="polite">
              Your letters will live at{" "}
              <span className="font-mono text-ink">/{handlePreview}/…</span>
            </p>
          ) : (
            <p id="handle-hint" className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only. This can&apos;t be changed later.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="display_name" className="text-sm font-medium text-foreground">
            Your name{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="display_name"
            name="display_name"
            type="text"
            placeholder={emailLocalPart || "How should we call you?"}
            autoComplete="name"
            className="focus-visible:ring-ring transition-shadow"
            aria-describedby="display-name-hint"
          />
          <p id="display-name-hint" className="text-xs text-muted-foreground">
            This is just for you — only you see it.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-wax text-primary-foreground hover:bg-wax-deep transition-colors rounded-full py-2.5 font-medium shadow-sm mt-2"
          disabled={pending}
        >
          {pending ? "Setting up your account…" : "Let’s go"}
        </Button>
      </form>
    </div>
  );
}
