import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
 *
 * Lazy singleton: the client is not created until first access, so importing
 * this module during Next.js build-time page-data collection does not throw
 * when environment variables are absent.
 */
let _adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return _adminClient;
}

/**
 * Proxy object that behaves exactly like a SupabaseClient but initializes
 * the underlying client lazily on first property access. This avoids the
 * module-evaluation-time `supabaseUrl is required` error during `next build`
 * when environment variables are not present in the build environment.
 */
export const adminClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAdminClient();
    return Reflect.get(client, prop, client);
  },
});
