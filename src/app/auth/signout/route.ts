import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Use 303 so the browser re-issues a GET (not a POST) to "/".
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
