import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only use.
 *
 * This client bypasses RLS and must NEVER be imported by client components.
 * Used for:
 *   - Uploading images to the private "letters" storage bucket
 *   - Any future service-role storage operations (signed URL minting, etc.)
 *
 * The `server-only` import at the top of this file ensures that any attempt
 * to import it in a client component will cause a build-time error.
 */
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
