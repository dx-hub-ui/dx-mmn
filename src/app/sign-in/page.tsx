// src/app/sign-in/page.tsx
"use client";
import { useMemo, useState } from "react";
import { Button, Flex, Loader, Text } from "@vibe/core";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./sign-in.module.css";

export default function SignInPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const REDIRECT = "/dashboard";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"sent"|"error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading"); setMsg(null);

    const emailRedirectTo =
      `https://app.dxhub.com.br/auth/callback?redirectTo=${encodeURIComponent(REDIRECT)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo }, // magic link (implicit)
    });

    if (error) { setStatus("error"); setMsg(error.message); return; }
    setStatus("sent"); setMsg("Link enviado. Abra o e-mail.");
  };

  return (
    <main className={styles.root}>
      <section className={styles.panel} aria-live="polite">
        <div className={styles.message}>
          {status === "loading" ? <Loader size={Loader.sizes.SMALL} /> : null}
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            {status === "sent" ? "Verifique seu e-mail" : "Entrar na plataforma"}
          </Text>
          {msg ? (
            <Text type={Text.types.TEXT3} color={status==="error"?Text.colors.NEGATIVE:Text.colors.SECONDARY}>
              {msg}
            </Text>
          ) : null}
        </div>

        {status !== "sent" ? (
          <form onSubmit={onSubmit} className={styles.form}>
            <label htmlFor="email" className={styles.label}>Email *</label>
            <input
              id="email" type="email" required
              value={email} onChange={(e)=>setEmail(e.target.value)}
              className={styles.input} autoComplete="email" inputMode="email"
              disabled={status==="loading"}
            />
            <Flex justify={Flex.justify.CENTER} gap={8}>
              <Button kind={Button.kinds.PRIMARY} type={Button.types.SUBMIT} disabled={!email || status==="loading"}>
                Enviar link
              </Button>
            </Flex>
          </form>
        ) : null}
      </section>
    </main>
  );
}
