"use client";

import { useEffect, useMemo, useState, type ComponentProps, type ComponentType } from "react";
import {
  AlertBanner,
  AlertBannerText,
  Button,
  Checkbox,
  Dialog,
  DialogContentContainer,
  Menu,
  MenuButton,
  MenuItem,
  Text,
} from "@vibe/core";
import { NavigationChevronDown } from "@vibe/icons";
import styles from "./notification-preferences-modal.module.css";

const timezoneFallback = ["UTC", "America/Sao_Paulo", "Europe/Lisbon", "America/New_York"];

function resolveTimezones() {
  if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
    try {
      return (Intl as any).supportedValuesOf("timeZone") as string[];
    } catch {
      return timezoneFallback;
    }
  }
  return timezoneFallback;
}

const TIMEZONES = resolveTimezones();

const ModalDialog = Dialog as unknown as ComponentType<ComponentProps<typeof Dialog> & { type?: string }>;

type NotificationPreferencesModalProps = {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
};

type PreferencesState = {
  emailWeekly: boolean;
  timezone: string;
};

const DEFAULT_STATE: PreferencesState = {
  emailWeekly: true,
  timezone: "UTC",
};

export default function NotificationPreferencesModal({ open, orgId, onClose, onSaved }: NotificationPreferencesModalProps) {
  const [state, setState] = useState<PreferencesState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const fetchPreferences = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/user/preferences?orgId=${encodeURIComponent(orgId)}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Falha ao buscar preferências (${response.status})`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setState({
            emailWeekly: payload.email_on_mention_weekly ?? true,
            timezone: payload.timezone ?? "UTC",
          });
        }
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar as preferências agora.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchPreferences();
    return () => {
      cancelled = true;
    };
  }, [open, orgId]);

  const currentTimezone = useMemo(() => state.timezone || "UTC", [state.timezone]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orgId,
          email_on_mention_weekly: state.emailWeekly,
          timezone: state.timezone,
        }),
      });
      if (!response.ok) {
        throw new Error(`Falha ao salvar preferências (${response.status})`);
      }
      onSaved();
    } catch {
      setError("Não foi possível salvar suas preferências. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      useDerivedStateFromProps
      type="modal"
      onDialogDidHide={onClose}
      onClickOutside={onClose}
      content={
        <DialogContentContainer className={styles.modal}>
          <div className={styles.header}>
            <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
              Preferências de notificações
            </Text>
            <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
              Controle como você quer ser lembrado de menções e escolha seu fuso horário de referência.
            </Text>
          </div>
          {error ? (
            <AlertBanner
              backgroundColor={AlertBanner.backgroundColors.NEGATIVE}
              onClose={() => setError(null)}
            >
              <AlertBannerText text={error} />
            </AlertBanner>
          ) : null}
          <div className={styles.body}>
            <Checkbox
              label="Receber resumo semanal por e-mail"
              checked={state.emailWeekly}
              disabled={loading || saving}
              onChange={() => setState((prev) => ({ ...prev, emailWeekly: !prev.emailWeekly }))}
            />
            <div>
              <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                Fuso horário
              </Text>
              <MenuButton
                ariaLabel="Selecionar fuso horário"
                closeMenuOnItemClick
                disabled={loading || saving}
                component={() => (
                  <Button
                    kind={Button.kinds.SECONDARY}
                    rightIcon={NavigationChevronDown}
                    className={styles.timezoneTrigger}
                  >
                    {currentTimezone}
                  </Button>
                )}
              >
                <Menu className={styles.menuList}>
                  {TIMEZONES.map((tz) => (
                    <MenuItem
                      key={tz}
                      title={tz}
                      selected={state.timezone === tz}
                      onClick={() => setState((prev) => ({ ...prev, timezone: tz }))}
                    />
                  ))}
                </Menu>
              </MenuButton>
            </div>
          </div>
          <div className={styles.footer}>
            <Button kind={Button.kinds.TERTIARY} onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button kind={Button.kinds.PRIMARY} onClick={handleSave} disabled={saving || loading}>
              Salvar preferências
            </Button>
          </div>
        </DialogContentContainer>
      }
    />
  );
}
