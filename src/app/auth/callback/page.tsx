"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Flex, Loader, Text } from "@vibe/core";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./callback.module.css";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const redirectParam = searchParams.get("redirectTo");
  const normalizedRedirect = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/app";
  const hasSupabaseEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const supabase = useMemo(() => {
    if (!hasSupabaseEnv) {
      return null;
    }

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

    const client = supabase;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(searchParamsString);

    const errorDescription =
      hashParams.get("error_description") ||
      hashParams.get("error") ||
      queryParams.get("error_description") ||
      queryParams.get("error");

    if (errorDescription) {
      setStatus("error");
      setMessage(errorDescription);
      return;
    }

    const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setStatus("error");
      setMessage("Não foi possível validar o link de autenticação.");
      return;
    }

    const validAccessToken = accessToken;
    const validRefreshToken = refreshToken;

    let isMounted = true;

    async function persistSession() {
      const { error } = await client.auth.setSession({
        access_token: validAccessToken,
        refresh_token: validRefreshToken,
      });

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("success");
      setMessage("Tudo pronto! Redirecionando...");
      router.replace(normalizedRedirect);
    }

    void persistSession();

    return () => {
      isMounted = false;
    };
  }, [supabase, router, normalizedRedirect, searchParamsString, hasSupabaseEnv]);

  const handleBackToSignIn = () => {
    router.replace(`/sign-in?redirectTo=${encodeURIComponent(normalizedRedirect)}`);
  };

  return (
    <main className={styles.root}>
      <section className={styles.panel} aria-live="polite">
        <div className={styles.message}>
          {status === "loading" ? <Loader size={Loader.sizes.SMALL} /> : null}
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            {status === "success" ? "Login confirmado" : status === "error" ? "Falha na autenticação" : "Validando link"}
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
