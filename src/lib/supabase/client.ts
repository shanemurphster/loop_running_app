import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client — used in client components. Carries the signed-in
// user's session via cookies; reads run under RLS as `anon` until a user signs
// in (which is how guest browsing works).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
