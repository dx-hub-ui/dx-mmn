// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Flex, Loader, Text } from "@vibe/core";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./callback.module.css";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");
  const normalizedRedirect =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : "/dashboard";
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const supabase = useMemo(() => {
    if (!hasSupabaseEnv) return null;
    return createSupabaseBrowserClient();
  }, [hasSupabaseEnv]);

  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [message, setMessage] = useState("Conectando à sua conta...");

  useEffect(() => {
    if (!supabase) {
      if (!hasSupabaseEnv) {
        setStatus("error");
        setMessage("Variáveis de ambiente do Supabase não configuradas.");
      }
      return;
    }

    let isMounted = true;

    const run = async () => {
      // Parse both hash and query for compatibility
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const url = new URL(window.location.href);
      const queryParams = url.searchParams;

      const errorDescription =
        hashParams.get("error_description") ||
        hashParams.get("error") ||
        queryParams.get("error_description") ||
        queryParams.get("error");

      if (errorDescription) {
        if (!isMounted) return;
        setStatus("error");
        setMessage(errorDescription);
        return;
      }

      // 1) PKCE code flow (recommended, current default)
      const pkceCode = queryParams.get("code") || hashParams.get("code");
      if (pkceCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (!isMounted) return;
        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }
        setStatus("success");
        setMessage("Tudo pronto! Redirecionando...");
        router.replace(normalizedRedirect);
        return;
      }

      // 2) Legacy implicit flow fallback (access_token in URL)
      const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!isMounted) return;
        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }
        setStatus("success");
        setMessage("Tudo pronto! Redirecionando...");
        router.replace(normalizedRedirect);
        return;
      }

      if (!isMounted) return;
      setStatus("error");
      setMessage("Não foi possível validar o link de autenticação.");
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, [supabase, router, normalizedRedirect, hasSupabaseEnv]);

  const handleBackToSignIn = () => {
    router.replace(`/sign-in?redirectTo=${encodeURIComponent(normalizedRedirect)}`);
  };

  return (
    <main className={styles.root}>
      <section className={styles.panel} aria-live="polite">
        <div className={styles.message}>
          {status === "loading" ? <Loader size={Loader.sizes.SMALL} /> : null}
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            {status === "success"
              ? "Login confirmado"
              : status === "error"
              ? "Falha na autenticação"
              : "Validando link"}
          </Text>
          <Text
            type={Text.types.TEXT3}
            color={status === "error" ? Text.colors.NEGATIVE : Text.colors.SECONDARY}
            className={status === "error" ? styles.errorText : undefined}
          >
            {message}
          </Text>
        </div>

        {status === "error" ? (
          <Flex justify={Flex.justify.CENTER}>
            <Button kind={Button.kinds.PRIMARY} type={Button.types.BUTTON} onClick={handleBackToSignIn}>
              Voltar para o login
            </Button>
          </Flex>
        ) : null}
      </section>
    </main>
  );
}
