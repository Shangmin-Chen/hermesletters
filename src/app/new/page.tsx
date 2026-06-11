import { requireProfile } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NewLetterForm } from "./new-letter-form";

export default async function NewLetterPage() {
  const profile = await requireProfile();

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 pt-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Write a letter</CardTitle>
          <CardDescription>
            Compose a letter, lock it with a secret question, and share the link.
            You won&apos;t be able to view it again without burning it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewLetterForm senderHandle={profile.handle as string} />
        </CardContent>
      </Card>
    </main>
  );
}
