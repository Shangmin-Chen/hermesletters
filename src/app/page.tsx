import Link from "next/link";
import { getUser, getProfile } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function Home() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Send a Letter
          </h1>
          <p className="text-lg text-gray-500">
            Write a letter. Lock it. Share it once.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {user ? (
            <Link
              href={profile ? "/dashboard" : "/onboarding"}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "default" }))}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
