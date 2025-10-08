// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Force magic-link implicit flow. No PKCE.
      auth: {
        flowType: "implicit",
        detectSessionInUrl: true, // auto-reads #access_token on callback
      },
    }
  );
}
