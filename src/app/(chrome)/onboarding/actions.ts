"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify, isValidHandle } from "@/lib/slugify";
import { RESERVED_HANDLES } from "@/lib/reserved-handles";
import { isSafeLocalPath } from "@/lib/safe-path";

const MAX_DISPLAY_NAME_LENGTH = 80;

type ActionState = { error?: string } | null;

export async function onboardingAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rawHandle = formData.get("handle") as string;
  const rawDisplayName = formData.get("display_name") as string;
  const rawNext = formData.get("next");
  const next =
    typeof rawNext === "string" && isSafeLocalPath(rawNext) ? rawNext : null;

  const handle = slugify(rawHandle ?? "");

  if (!handle) {
    return { error: "Handle is required." };
  }

  if (!isValidHandle(handle)) {
    return { error: "Handle must contain only letters, numbers, and dashes, and cannot start or end with a dash." };
  }

  // Fix 3: reject reserved handles before touching the DB
  if (RESERVED_HANDLES.has(handle)) {
    return { error: "That handle is reserved, choose another." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fix 5: derive display name from server-verified user, never from client input
  const serverEmailLocalPart = user.email?.split("@")[0] ?? handle;
  const trimmedDisplayName = rawDisplayName?.trim() ?? "";
  const displayName =
    trimmedDisplayName.length > 0
      ? trimmedDisplayName.slice(0, MAX_DISPLAY_NAME_LENGTH)
      : serverEmailLocalPart;

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    handle,
    display_name: displayName,
  });

  if (error) {
    // Postgres unique violation code 23505
    if (error.code === "23505") {
      return { error: "That handle is already taken. Please choose another." };
    }
    console.error("Failed to create onboarding profile", {
      code: error.code,
      handle,
    });
    return { error: "Something went wrong creating your profile. Please try again." };
  }

  // Profile created — return the user to their letter if a safe `next` was
  // threaded through the registration chain, else the dashboard.
  redirect(next ?? "/dashboard");
}
