"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Divider, Flex, Text, TextField } from "@vibe/core";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./sign-in.module.css";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectParam = searchParams.get("redirectTo");
  const redirectFallback = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/app";
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasSupabaseEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const supabase = useMemo(() => {
    if (!hasSupabaseEnv) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, [hasSupabaseEnv]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!supabase) {
        setErrorMessage("Supabase não está configurado. Verifique as variáveis de ambiente.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setStatusMessage(null);

      const normalizedRedirect = redirectFallback.startsWith("/") ? redirectFallback : "/app";
      const origin = window.location.origin;
      const emailRedirectTo = `${origin}/auth/callback?redirectTo=${encodeURIComponent(normalizedRedirect)}`;

      const normalizedEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setStatusMessage("Enviamos um link mágico para o seu email. Abra o link para continuar.");
      }

      setIsLoading(false);
    },
    [supabase, email, redirectFallback],
  );

  const handleBackToHome = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <main className={styles.root}>
      <section className={styles.panel} aria-labelledby="sign-in-title">
        <div className={styles.logoArea}>
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD} id="sign-in-title">
            Entrar na plataforma
          </Text>
          <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY} className={styles.helperText}>
            Use o email cadastrado para receber um link mágico de acesso.
          </Text>
        </div>

        <Divider />

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <TextField
            title="Email"
            placeholder="nome@empresa.com"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(value) => setEmail(value)}
          />

          <div className={styles.actions}>
            <Button
              kind={Button.kinds.PRIMARY}
              size={Button.sizes.LARGE}
              type={Button.types.SUBMIT}
              disabled={!email.trim() || isLoading}
              loading={isLoading}
            >
              Enviar link de acesso
            </Button>
            <Button kind={Button.kinds.SECONDARY} type={Button.types.BUTTON} onClick={handleBackToHome} disabled={isLoading}>
              Voltar para a home
            </Button>
          </div>
        </form>

        {statusMessage ? (
          <div className={styles.statusMessage} role="status">
            <Text type={Text.types.TEXT3}>{statusMessage}</Text>
          </div>
        ) : null}

        {errorMessage ? (
          <div className={styles.errorMessage} role="alert">
            <Text type={Text.types.TEXT3} color={Text.colors.NEGATIVE}>
              {errorMessage}
            </Text>
          </div>
        ) : null}

        <Text type={Text.types.TEXT3} className={styles.redirectHint}>
          Após confirmar o login, você será direcionado para {redirectFallback}.
        </Text>

        {!hasSupabaseEnv ? (
          <Text type={Text.types.TEXT3} color={Text.colors.NEGATIVE} className={styles.helperText}>
            Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para habilitar o login.
          </Text>
        ) : null}

        <Flex gap={8} justify={Flex.justify.CENTER} className={styles.helperText}>
          <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
            Sem convite?
          </Text>
          <Text type={Text.types.TEXT3} weight={Text.weights.BOLD}>
            Peça ao administrador da sua organização.
          </Text>
        </Flex>
      </section>
    </main>
  );
}
