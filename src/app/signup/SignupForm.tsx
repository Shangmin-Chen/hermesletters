"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "./actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpAction, null);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8">
      <form action={formAction} className="space-y-5" noValidate>
        {state?.error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive"
          >
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="focus-visible:ring-ring transition-shadow"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Something only you'd remember"
            required
            autoComplete="new-password"
            minLength={6}
            className="focus-visible:ring-ring transition-shadow"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            Must be at least 6 characters.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-wax text-primary-foreground hover:bg-wax-deep transition-colors rounded-full py-2.5 font-medium shadow-sm mt-2"
          disabled={pending}
        >
          {pending ? "Creating your account…" : "Create account"}
        </Button>

        <p className="text-sm text-muted-foreground text-center pt-1">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-ink underline underline-offset-4 hover:text-wax transition-colors"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
