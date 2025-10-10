// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SupabaseConfigurationError } from "./errors";

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabaseConfigurationError();
  }

  const store = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          store.set({ name, value, ...options });
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "[createSupabaseServerClient] Ignoring cookie mutation (set) outside of a Server Action/Route Handler.",
              error
            );
          }
        }
      },
      remove(name: string, options: any) {
        try {
          if (typeof (store as any).delete === "function") {
            (store as any).delete({ name, ...options });
            return;
          }

          store.set({ name, value: "", ...options });
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "[createSupabaseServerClient] Ignoring cookie mutation (remove) outside of a Server Action/Route Handler.",
              error
            );
          }
        }
      },
    },
  });
}
