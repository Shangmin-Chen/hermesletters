import "server-only";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getConnections } from "@/lib/connections";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClearConnectionsBadge } from "./ClearConnectionsBadge";

export const dynamic = "force-dynamic";

export default async function PhonebookPage() {
  const profile = await requireProfile();
  const connections = await getConnections(profile.id);

  return (
    <main className="flex flex-1 flex-col items-center p-4 pt-10 sm:p-6">
      {/* Mark connections as seen on visit — clears the dashboard red dot. */}
      <ClearConnectionsBadge />
      <div className="w-full max-w-2xl space-y-6 animate-rise-in">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-serif text-xl">Phonebook</CardTitle>
              <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                {connections.length}
              </span>
            </div>
            <CardDescription>
              People connected through kept letters — write any of them a
              letter that lands sealed in their inbox.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {connections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connections yet — they appear once a kept letter connects
                you with someone. Once you&apos;re connected, you can write each other
                directly.
              </p>
            ) : (
              <ul className="divide-y">
                {connections.map((conn) => (
                  <li
                    key={conn.id}
                    className="flex items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">@{conn.handle}</p>
                      {conn.displayName && (
                        <p className="truncate text-sm text-muted-foreground">
                          {conn.displayName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Connected through a kept letter
                      </p>
                    </div>
                    <Link
                      href={`/new?to=${encodeURIComponent(conn.handle)}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "shrink-0"
                      )}
                    >
                      Send a letter
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
