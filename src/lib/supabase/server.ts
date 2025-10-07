import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const canSet = typeof (cookieStore as unknown as { set?: unknown }).set === "function";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: Record<string, unknown>) {
        if (!canSet) return;
        (cookieStore as unknown as { set: (args: Record<string, unknown>) => void }).set({
          name,
          value,
          ...(options ?? {}),
        });
      },
      remove(name: string, options?: Record<string, unknown>) {
        if (!canSet) return;
        (cookieStore as unknown as { set: (args: Record<string, unknown>) => void }).set({
          name,
          value: "",
          ...(options ?? {}),
          expires: new Date(0),
        });
      },
    },
  });
}
