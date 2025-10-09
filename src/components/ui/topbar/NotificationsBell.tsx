"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Badge, Dialog, DialogContentContainer, IconButton } from "@vibe/core";
import { Notifications } from "@vibe/icons";
import { captureException } from "@sentry/nextjs";
import { trackEvent } from "@/lib/telemetry";
import { getRequestContext } from "@/lib/request-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";
import type { NotificationCountResponse } from "@/types/notifications";
import styles from "./notifications-bell.module.css";
import type { ComponentType } from "react";
import type { DialogProps, DialogType } from "@vibe/core";

const COUNT_ENDPOINT = "/api/notifications/count";

const fetcher = async (input: string): Promise<NotificationCountResponse> => {
  const response = await fetch(input, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar contador (${response.status})`);
  }
  return response.json();
};

type NotificationsBellProps = {
  orgId: string;
  orgName: string;
};

const PopoverDialog = Dialog as unknown as ComponentType<DialogProps & { type?: DialogType }>;

export default function NotificationsBell({ orgId, orgName }: NotificationsBellProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(0);

  const context = getRequestContext();
  const userId = context?.userId ?? null;

  const { data, error, isLoading, mutate } = useSWR<NotificationCountResponse>(
    orgId ? `${COUNT_ENDPOINT}?orgId=${encodeURIComponent(orgId)}` : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const unreadCount = data?.unreadCount ?? 0;

  const showBadge = unreadCount > 0;

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        trackEvent("notifications.panel_open", {
          org_id: orgId,
          user_id: userId ?? undefined,
        });
      }
      return next;
    });
  }, [orgId, userId]);

  const handleClose = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const handleRealtimeEvent = useCallback(() => {
    mutate();
    trackEvent("notifications.realtime_receive", {
      org_id: orgId,
      user_id: userId ?? undefined,
    });
  }, [mutate, orgId, userId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPanelKey((prev) => prev + 1);
  }, [open]);

  useEffect(() => {
    if (!userId || !orgId) {
      return undefined;
    }

    const client = createSupabaseBrowserClient();
    const channel = client.channel(`realtime:notifications:user_${userId}`, {
      config: { broadcast: { ack: true } },
    });

    channel
      .on("broadcast", { event: "notification.created" }, handleRealtimeEvent)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, handleRealtimeEvent);

    channel.subscribe().catch((subscribeError) => {
      captureException(subscribeError, {
        tags: { module: "notifications", action: "subscribe" },
        extra: { userId, orgId },
      });
    });

    return () => {
      client.removeChannel(channel);
    };
  }, [handleRealtimeEvent, orgId, userId]);

  if (!orgId) {
    return null;
  }

  if (isLoading) {
    return <div className={styles.loadingSkeleton} aria-label="Carregando notificações" role="status" />;
  }

  const hasError = Boolean(error);

  return (
    <PopoverDialog
      open={open}
      useDerivedStateFromProps
      type="popover"
      position="bottom-end"
      moveBy={{ main: 0, secondary: 8 }}
      showTrigger={[]}
      hideTrigger={[]}
      onClickOutside={handleClose}
      onDialogDidHide={handleClose}
      content={
        <DialogContentContainer className={styles.dialogContent}>
          <NotificationsPanel
            key={panelKey}
            orgId={orgId}
            orgName={orgName}
            initialUnreadCount={unreadCount}
            onClose={handleClose}
            onUnreadCountChange={(next) => {
              mutate({ unreadCount: next }, { revalidate: false });
            }}
          />
        </DialogContentContainer>
      }
    >
      <div className={styles.button}>
        <IconButton
          ref={buttonRef}
          icon={Notifications}
          ariaLabel={hasError ? "Erro ao carregar notificações" : "Notificações"}
          tooltipContent={hasError ? "Tentar novamente" : "Notificações"}
          size={IconButton.sizes.MEDIUM}
          kind={IconButton.kinds.TERTIARY}
          onClick={() => {
            if (hasError) {
              mutate();
              return;
            }
            handleToggle();
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
        />
        {showBadge ? (
          <span className={styles.badgeWrapper} aria-hidden>
            <Badge type={Badge.types.COUNTER} color={Badge.colors.PRIMARY} count={unreadCount} maxDigits={3} />
          </span>
        ) : null}
      </div>
    </PopoverDialog>
  );
}
