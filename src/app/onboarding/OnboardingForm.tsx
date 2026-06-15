"use client";

import { useActionState, useState } from "react";
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

interface OnboardingFormProps {
  emailLocalPart: string;
  next?: string | null;
}

export function OnboardingForm({ emailLocalPart, next }: OnboardingFormProps) {
  const [state, formAction, pending] = useActionState(onboardingAction, null);
  const [handlePreview, setHandlePreview] = useState("");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Choose your handle</CardTitle>
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
              onChange={(e) => setHandlePreview(slugify(e.target.value))}
            />
            {handlePreview && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Will appear as: <span className="font-mono">{handlePreview}</span>
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
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving..." : "Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
