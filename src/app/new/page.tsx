import { requireProfile } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewLetterPage() {
  await requireProfile();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Write a letter</CardTitle>
          <CardDescription>
            This compose form is coming in Phase 4.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stay tuned — the letter creation form will be built here.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
