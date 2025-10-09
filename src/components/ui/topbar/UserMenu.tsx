"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Menu, MenuButton, MenuDivider, MenuItem } from "@vibe/core";
import { Check, LogOut, Moon, Night, Person, Sun, Warning } from "@vibe/icons";
import { captureException } from "@sentry/nextjs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { applyTheme, DEFAULT_THEME, readStoredTheme, ThemePreference } from "@/lib/theme";
import { trackEvent } from "@/lib/telemetry";
import AccountModal, { UserProfile } from "./AccountModal";
import styles from "./user-menu.module.css";

type ThemeOption = {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "night", label: "Noite", icon: Night },
];

function initialsFromProfile(profile: UserProfile | null) {
  const source = profile?.display_name || `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }
  const email = profile?.email ?? "";
  return email.slice(0, 2).toUpperCase() || "?";
}

export default function UserMenu() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>(DEFAULT_THEME);
  const [themeUpdating, setThemeUpdating] = useState<ThemePreference | null>(null);

  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) {
      setCurrentTheme(stored);
      applyTheme(stored, { persist: false });
    }

    let isMounted = true;
    const load = async () => {
      try {
        const response = await fetch("/api/user/profile", { cache: "no-store" });
        if (response.status === 401) {
          router.push("/sign-in");
          return;
        }
        if (!response.ok) {
          throw new Error("Não foi possível carregar o perfil");
        }
        const data = (await response.json()) as { profile: UserProfile };
        if (!isMounted) {
          return;
        }
        setProfile(data.profile);
        if (data.profile.theme_preference) {
          setCurrentTheme(data.profile.theme_preference);
          applyTheme(data.profile.theme_preference);
        }
      } catch (error) {
        captureException(error instanceof Error ? error : new Error(String(error)));
        if (!isMounted) {
          return;
        }
        setMenuError(error instanceof Error ? error.message : "Erro ao carregar perfil");
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const avatarInitials = useMemo(() => initialsFromProfile(profile), [profile]);

  const handleThemeChange = useCallback(
    async (theme: ThemePreference) => {
      if (theme === currentTheme && profile?.theme_preference === theme) {
        applyTheme(theme);
        return;
      }

      const previousTheme = currentTheme;
      setThemeUpdating(theme);
      setMenuError(null);

      try {
        applyTheme(theme);
        setCurrentTheme(theme);
        trackEvent("user_menu/theme_change", { theme });
        const response = await fetch("/api/user/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme_preference: theme }),
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorBody.error ?? "Não foi possível mudar o tema");
        }

        const data = (await response.json()) as { profile: UserProfile };
        setProfile(data.profile);
      } catch (error) {
        captureException(error instanceof Error ? error : new Error(String(error)));
        const message = error instanceof Error ? error.message : "Não foi possível mudar o tema";
        setMenuError(message);
        setCurrentTheme(previousTheme);
        applyTheme(previousTheme);
        trackEvent("profile/save_error", { reason: "theme_change", message });
      } finally {
        setThemeUpdating(null);
      }
    },
    [currentTheme, profile]
  );

  const handleLogout = useCallback(async () => {
    setMenuError(null);
    try {
      await supabase.auth.signOut();
      trackEvent("auth/logout");
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)));
      setMenuError("Não foi possível sair");
    } finally {
      router.push("/sign-in");
    }
  }, [router, supabase]);

  const handleProfileUpdated = useCallback(
    (updated: UserProfile) => {
      setProfile(updated);
      if (updated.theme_preference) {
        setCurrentTheme(updated.theme_preference);
        applyTheme(updated.theme_preference);
      }
    },
    []
  );

  const avatarSrc = profile?.avatar_url ?? undefined;
  const avatarType = avatarSrc ? Avatar.types.IMG : Avatar.types.TEXT;

  return (
    <>
      <MenuButton
        className={styles.menuButton}
        ariaLabel="Abrir menu do usuário"
        dialogPosition={MenuButton.dialogPositions.BOTTOM_END}
        dialogClassName={styles.menuDialog}
        zIndex={12000}
        closeMenuOnItemClick
        component={() => (
          <Avatar
            id="user-menu-avatar"
            size={Avatar.sizes.LARGE}
            type={avatarType}
            src={avatarSrc}
            text={!avatarSrc ? avatarInitials : undefined}
            ariaLabel={profile?.display_name ?? profile?.email ?? "Conta"}
            className={styles.avatar}
          />
        )}
        onMenuShow={() => {
          trackEvent("user_menu/open");
          setMenuError(null);
        }}
        onMenuHide={() => setMenuError(null)}
      >
        <Menu>
          {profile ? (
            <MenuItem
              disabled
              title={profile.display_name ?? profile.email ?? "Minha conta"}
              label={profile.email && profile.display_name !== profile.email ? profile.email : undefined}
              className={styles.menuTitle}
            />
          ) : null}
          {menuError ? (
            <MenuItem disabled icon={Warning} title={menuError} className={styles.errorItem} />
          ) : null}
          <MenuItem
            title="Minha conta"
            icon={Person}
            onClick={() => setAccountOpen(true)}
            disabled={loadingProfile || !profile}
          />
          <MenuItem title="Mudar tema" icon={Sun} submenuPosition="left" disabled={Boolean(themeUpdating)}>
            <Menu>
              {THEME_OPTIONS.map((option) => (
                <MenuItem
                  key={option.value}
                  title={option.label}
                  icon={currentTheme === option.value ? Check : option.icon}
                  selected={currentTheme === option.value}
                  label={themeUpdating === option.value ? "Aplicando..." : undefined}
                  onClick={() => handleThemeChange(option.value)}
                />
              ))}
            </Menu>
          </MenuItem>
          <MenuDivider />
          <MenuItem title="Logout" icon={LogOut} onClick={handleLogout} />
        </Menu>
      </MenuButton>
      <AccountModal
        open={accountOpen}
        profile={profile}
        onClose={() => setAccountOpen(false)}
        onProfileUpdated={handleProfileUpdated}
      />
    </>
  );
}
