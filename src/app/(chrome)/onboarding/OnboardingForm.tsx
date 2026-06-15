"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { onboardingAction } from "./actions";
import { slugify } from "@/lib/slugify";
import { RESERVED_HANDLES } from "@/lib/reserved-handles";

interface OnboardingFormProps {
  emailLocalPart: string;
  next?: string | null;
}

type HandleStatus = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";

export function OnboardingForm({ emailLocalPart, next }: OnboardingFormProps) {
  const [state, formAction, pending] = useActionState(onboardingAction, null);
  const [handlePreview, setHandlePreview] = useState("");
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the most-recently queued handle so stale responses from earlier
  // (slower) requests are discarded when the user has already typed ahead.
  const latestHandleRef = useRef<string>("");

  // Clean up the debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const slugged = slugify(e.target.value);
    setHandlePreview(slugged);

    // Clear any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!slugged) {
      setHandleStatus("idle");
      return;
    }

    // Client-side reserved check is instant — no need to hit the server
    if (RESERVED_HANDLES.has(slugged)) {
      setHandleStatus("reserved");
      return;
    }

    // Show "checking" immediately, then debounce the real network request
    setHandleStatus("checking");
    // Record which handle this check is for so we can discard stale responses.
    latestHandleRef.current = slugged;

    debounceRef.current = setTimeout(async () => {
      // Capture the handle this closure is checking.
      const queriedHandle = slugged;
      try {
        const res = await fetch(
          `/api/handles/check?handle=${encodeURIComponent(queriedHandle)}`
        );
        // If the user has typed ahead, discard this (now-stale) response.
        if (latestHandleRef.current !== queriedHandle) return;
        if (!res.ok) {
          // Fail open — don't block the form on a transient error
          setHandleStatus("idle");
          return;
        }
        const data = (await res.json()) as { available: boolean; reason: string };
        // Final stale check after the async JSON parse.
        if (latestHandleRef.current !== queriedHandle) return;
        if (data.available) {
          setHandleStatus("available");
        } else if (data.reason === "reserved") {
          setHandleStatus("reserved");
        } else {
          setHandleStatus("taken");
        }
      } catch {
        // Network error — fail open (only if this response is still current).
        if (latestHandleRef.current === queriedHandle) setHandleStatus("idle");
      }
    }, 400);
  }

  const isBlocked =
    handleStatus === "reserved" || handleStatus === "taken" || handleStatus === "checking";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-serif text-xl">Choose your handle</CardTitle>
        <CardDescription>
          Your handle appears in letter URLs and cannot be changed later.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              name="handle"
              type="text"
              placeholder="your-handle"
              required
              autoComplete="off"
              onChange={handleChange}
            />
            {handlePreview && handleStatus !== "idle" && (
              <p
                className={`text-xs ${
                  handleStatus === "reserved" || handleStatus === "taken"
                    ? "text-destructive"
                    : handleStatus === "available"
                      ? "text-green-700 dark:text-green-400"
                      : "text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {handleStatus === "checking" && (
                  <span>Checking&hellip;</span>
                )}
                {handleStatus === "available" && (
                  <span>
                    <span className="font-mono">{handlePreview}</span> is available
                  </span>
                )}
                {handleStatus === "taken" && (
                  <span>
                    <span className="font-mono">{handlePreview}</span> is already taken
                  </span>
                )}
                {handleStatus === "reserved" && (
                  <span>
                    &ldquo;{handlePreview}&rdquo; is reserved and cannot be used
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="display_name">
              Display name{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="display_name"
              name="display_name"
              type="text"
              placeholder={emailLocalPart}
              autoComplete="name"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={pending || isBlocked}
          >
            {pending ? "Saving..." : "Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
