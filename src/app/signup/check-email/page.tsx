import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent you a confirmation link. Click it to activate your account
            and continue to onboarding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Already confirmed?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
