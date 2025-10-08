// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flex, Loader, Text } from "@vibe/core";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const EMAIL_OTP_TYPES = [
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email",
  "email_change",
] as const;

type EmailOtpTypeCandidate = (typeof EMAIL_OTP_TYPES)[number];

const isEmailOtpType = (value: string | null | undefined): value is EmailOtpTypeCandidate =>
  Boolean(value) && (EMAIL_OTP_TYPES as ReadonlyArray<string>).includes(value!);

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

        const code = pickParam("code");
        const token = pickParam("token");
        const tokenHash = pickParam("token_hash");
        const accessTokenParam = pickParam("access_token");
        const refreshTokenParam = pickParam("refresh_token");
        const emailParam = pickParam("email") ?? pickParam("user_email") ?? undefined;
        const rawType = pickParam("type")?.toLowerCase() ?? undefined;
        const otpTypeCandidates = Array.from(
          new Set<EmailOtpTypeCandidate>([
            ...(isEmailOtpType(rawType) ? [rawType] : []),
            ...EMAIL_OTP_TYPES,
          ]),
        );

        if (!session && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (shouldStopDueTo(error)) {
              // tenta fallback com tokens
            } else {
              return;
            }
          } else {
            captureSession(data.session);
          }
        }

        const canUseTokenHash = Boolean(tokenHash);
        const canUseToken = Boolean(token && emailParam);

        if (!session && (canUseTokenHash || canUseToken) && otpTypeCandidates.length > 0) {
          type VerifyResult = "success" | "retry" | "fatal";
          let lastError: string | null = null;

          const attemptVerify = async (
            payload: Parameters<typeof supabase.auth.verifyOtp>[0],
          ): Promise<VerifyResult> => {
            const { data, error } = await supabase.auth.verifyOtp(payload);
            if (error) {
              lastError = error.message;
              if (/token (?:not found|has expired)/i.test(error.message)) {
                return "retry";
              }
              surfaceError(error.message);
              return "fatal";
            }
            captureSession(data.session);
            lastError = null;
            return "success";
          };

          if (canUseTokenHash) {
            for (const typeCandidate of otpTypeCandidates) {
              const result = await attemptVerify({
                type: typeCandidate,
                token_hash: tokenHash!,
              });

              if (result === "success") {
                break;
              }

              if (result === "fatal") {
                return;
              }
            }
          }

          if (!session && canUseToken) {
            for (const typeCandidate of otpTypeCandidates) {
              const result = await attemptVerify({
                type: typeCandidate,
                token: token!,
                email: emailParam!,
              });

              if (result === "success") {
                break;
              }

              if (result === "fatal") {
                return;
              }
            }
          }

          if (!session && lastError) {
            surfaceError(lastError);
            return;
          }
        }

        if (!session && accessTokenParam && refreshTokenParam) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessTokenParam,
            refresh_token: refreshTokenParam,
          });
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
