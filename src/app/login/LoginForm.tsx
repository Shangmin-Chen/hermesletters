"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next?: string | null }) {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8">
      <form action={formAction} className="space-y-5" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

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
            required
            autoComplete="current-password"
            className="focus-visible:ring-ring transition-shadow"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-wax text-primary-foreground hover:opacity-90 transition-opacity rounded-full py-2.5 font-medium shadow-sm mt-2"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-sm text-muted-foreground text-center pt-1">
          New here?{" "}
          <Link
            href="/signup"
            className="text-ink underline underline-offset-4 hover:text-wax transition-colors"
          >
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
