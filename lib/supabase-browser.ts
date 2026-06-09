import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client — stores session in cookies so the
 * middleware can read it. Use this in client components for login/logout.
 */
export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
