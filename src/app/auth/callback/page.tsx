// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flex, Loader, Text } from "@vibe/core";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo")?.startsWith("/") ? searchParams.get("redirectTo")! : "/dashboard";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [err, setErr] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const surfaceError = (message: string) => {
      if (!cancelled) {
        setErr(message);
        setProcessing(false);
      }
    };

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const search = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const pickParam = (key: string) => search.get(key) ?? hash.get(key);

        const errorDescription = pickParam("error_description") ?? pickParam("error");
        if (errorDescription) {
          surfaceError(errorDescription);
          return;
        }

        const shouldStopDueTo = (maybeError: Error | null | undefined) => {
          if (!maybeError) return false;
          const message = maybeError.message ?? "Erro ao recuperar sessão.";
          if (/code verifier/i.test(message) || /invalid request/i.test(message)) {
            console.warn("Supabase PKCE fallback:", message);
            return false;
          }
          surfaceError(message);
          return true;
        };

        let {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError && shouldStopDueTo(sessionError)) {
          return;
        }

        const captureSession = (maybeSession: typeof session) => {
          if (maybeSession) {
            session = maybeSession;
          }
        };

        const hasCode = Boolean(pickParam("code"));
        const hasToken = Boolean(pickParam("token"));
        const hasTokenHash = Boolean(pickParam("token_hash"));
        const hasAccessPair = Boolean(pickParam("access_token") && pickParam("refresh_token"));

        if (!session && (hasCode || hasAccessPair)) {
          const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
          if (error) {
            if (shouldStopDueTo(error)) {
              return;
            }
          } else {
            captureSession(data.session);
          }
        }

        if (!session && (hasToken || hasTokenHash)) {
          const rawType = pickParam("type");
          const emailParam = pickParam("email") ?? pickParam("user_email") ?? undefined;
          const tokenValue = pickParam("token") ?? pickParam("token_hash");
          const tokenKey = pickParam("token") ? "token" : "token_hash";

          if (tokenValue) {
            const typeCandidates = Array.from(
              new Set(
                [
                  rawType,
                  rawType === "recovery" ? "recovery" : null,
                  rawType === "signup" ? "signup" : null,
                  rawType === "invite" ? "invite" : null,
                  "magiclink",
                  "email",
                ].filter(Boolean) as string[],
              ),
            );

            let lastError: string | null = null;
            for (const typeCandidate of typeCandidates) {
              const verifyPayload = {
                type: typeCandidate as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
                [tokenKey]: tokenValue,
                ...(emailParam ? { email: emailParam } : {}),
              } as Parameters<typeof supabase.auth.verifyOtp>[0];

              const { data, error } = await supabase.auth.verifyOtp(verifyPayload);
              if (error) {
                lastError = error.message;
                if (!/token not found/i.test(error.message)) {
                  break;
                }
                continue;
              }
              captureSession(data.session);
              lastError = null;
              break;
            }

            if (!session && lastError) {
              surfaceError(lastError);
              return;
            }
          }
        }

        if (!session && hasAccessPair) {
          const accessToken = pickParam("access_token")!;
          const refreshToken = pickParam("refresh_token")!;
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) {
            surfaceError(error.message);
            return;
          }
          captureSession(data.session);
        }

        if (!session) {
          surfaceError("Link inválido ou expirado.");
          return;
        }

        const accessToken = session.access_token;
        const refreshToken = session.refresh_token;
        if (!accessToken || !refreshToken) {
          surfaceError("Link inválido ou expirado.");
          return;
        }

        const syncResponse = await fetch("/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
          cache: "no-store",
        });

        if (!syncResponse.ok) {
          const bodyText = await syncResponse.text().catch(() => "Falha ao sincronizar.");
          surfaceError(bodyText || "Falha ao sincronizar.");
          return;
        }

        const clean = new URL(window.location.href);
        clean.hash = "";
        clean.search = "";
        clean.pathname = "/auth/callback";
        window.history.replaceState({}, "", clean.toString());

        window.location.replace(redirectTo);
      } catch (error) {
        console.error("Erro ao processar callback de autenticação", error);
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        surfaceError(message);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [redirectTo, supabase]);

  return (
    <Flex
      direction={Flex.directions.COLUMN}
      align={Flex.align.CENTER}
      justify={Flex.justify.CENTER}
      gap={12}
      style={{ minHeight: "100vh", padding: 24 }}
    >
      {processing && !err ? (
        <>
          <Loader size={Loader.sizes.SMALL} />
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            Confirmando seu acesso...
          </Text>
        </>
      ) : null}

      {err ? (
        <Text type={Text.types.TEXT3} color={Text.colors.NEGATIVE} align={Text.align.CENTER}>
          Erro de autenticação: {err}
        </Text>
      ) : null}
    </Flex>
  );
}
