// src/app/sign-in/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Button, Flex, Loader, Text } from "@vibe/core";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./sign-in.module.css";

export default function SignInPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirectParam = sp.get("redirectTo");
  const normalizedRedirect = redirectParam?.startsWith("/") ? redirectParam : "/dashboard";

  const hasEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const supabase = useMemo(() => (hasEnv ? createSupabaseBrowserClient() : null), [hasEnv]);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setStatus("error");
      setMessage("Variáveis de ambiente do Supabase não configuradas.");
      return;
    }
    setStatus("loading");
    setMessage(null);

    const emailRedirectTo = `https://app.dxhub.com.br/auth/callback?redirectTo=${encodeURIComponent(
      normalizedRedirect
    )}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Enviamos um link de acesso para seu e-mail.");
  };

  const goCallback = () => {
    router.replace(`/auth/callback?redirectTo=${encodeURIComponent(normalizedRedirect)}`);
  };

  return (
    <main className={styles.root}>
      <section className={styles.panel} aria-live="polite">
        <div className={styles.message}>
          {status === "loading" ? <Loader size={Loader.sizes.SMALL} /> : null}
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            {status === "sent" ? "Verifique seu e-mail" : "Entrar"}
          </Text>
          {message ? (
            <Text
              type={Text.types.TEXT3}
              color={status === "error" ? Text.colors.NEGATIVE : Text.colors.SECONDARY}
              className={status === "error" ? styles.errorText : undefined}
            >
              {message}
            </Text>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <label htmlFor="email" className={styles.label}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            placeholder="seu@email.com"
            autoComplete="email"
            inputMode="email"
          />
          <Flex justify={Flex.justify.CENTER} gap={8}>
            <Button
              kind={Button.kinds.PRIMARY}
              type={Button.types.SUBMIT}
              disabled={status === "loading" || !email}
            >
              Enviar link
            </Button>
            <Button
              kind={Button.kinds.SECONDARY}
              type={Button.types.BUTTON}
              onClick={goCallback}
            >
              Já tenho link
            </Button>
          </Flex>
        </form>
      </section>
    </main>
  );
}
