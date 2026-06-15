import { NewLetterForm } from "@/app/(chrome)/new/new-letter-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DevBack } from "../DevBack";

// Submitting calls the real server action, so unauthenticated QA redirects to login.
export default function DevCompose() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <DevBack />
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Compose fixture</CardTitle>
          <CardDescription>
            Same simple form as the production write flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewLetterForm senderHandle="demo" />
        </CardContent>
      </Card>
    </main>
  );
}
