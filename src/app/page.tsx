import Link from "next/link";
import { getUser, getProfile } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function Home() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-950">
            Send a Letter
          </h1>
          <p className="text-lg leading-8 text-gray-600">
            Write a private letter. Lock it behind a secret only they know.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {user ? (
            <Link
              href={profile ? "/dashboard" : "/onboarding"}
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
              >
                Get started
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full sm:w-auto"
                )}
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
