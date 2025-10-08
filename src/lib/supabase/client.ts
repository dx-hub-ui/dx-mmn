// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // PKCE is default in supabase-js v2; keep explicit for clarity
    { auth: { flowType: "pkce", detectSessionInUrl: false } }
  );
}
