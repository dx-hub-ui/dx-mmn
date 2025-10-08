// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce", // suporta links magic e troca de código
        detectSessionInUrl: false, // o callback processa manualmente os parâmetros da URL
        persistSession: true, // garante que a sessão sobreviva a recarregamentos/fechamento do navegador
        autoRefreshToken: true, // renova tokens automaticamente enquanto o usuário estiver logado
      },
    }
  );
}
