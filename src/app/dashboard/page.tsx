import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const profile = await requireProfile();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Welcome back,{" "}
              <span className="font-medium text-foreground">
                {profile.display_name ?? profile.handle}
              </span>
              . Your handle is{" "}
              <span className="font-mono font-medium text-foreground">
                @{profile.handle}
              </span>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/new"
              className={cn(buttonVariants({ variant: "default" }), "w-full inline-flex justify-center")}
            >
              Write a letter
            </Link>
            <form action="/auth/signout" method="POST">
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Received mail</CardTitle>
            <CardDescription>
              Letters saved to your account will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No letters yet.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
