"use client";

import { useActionState } from "react";
import Link from "next/link";
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
import { signUpAction } from "./actions";

export function SignupForm({ next }: { next?: string | null }) {
  const [state, formAction, pending] = useActionState(signUpAction, null);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-serif">Create an account</CardTitle>
        <CardDescription>Sign up to start sending letters.</CardDescription>
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account..." : "Sign up"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
