import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — BYPASSES RLS. Server-only, never import into a client
// component. Used for trusted writes the public can't do: seeding routes and
// persisting discovered routes + clusters.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
