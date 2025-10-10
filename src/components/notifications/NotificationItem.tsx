"use client";

import { useMemo } from "react";
import { Avatar, IconButton, Menu, MenuButton, MenuItem, Text } from "@vibe/core";
import { Mute, NewTab, Show, Hide, MoreBelow, NotificationsMuted } from "@vibe/icons";
import clsx from "clsx";
import styles from "./notification-item.module.css";
import type { NotificationItemDTO, NotificationStatus } from "@/types/notifications";
import { formatRelativeTime } from "@/lib/notifications/utils";

function renderWithMentions(text: string | null) {
  if (!text) {
    return null;
  }

  const parts = text.split(/(\@[a-zA-Z0-9_.-]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span key={`mention-${index}`} className={styles.highlight}>
          {part}
        </span>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

type NotificationItemProps = {
  item: NotificationItemDTO;
  onOpen: (item: NotificationItemDTO) => void;
  onToggleRead: (item: NotificationItemDTO, nextStatus: Exclude<NotificationStatus, "hidden">) => void;
  onMuteSource: (item: NotificationItemDTO, scope: "source" | "type") => void;
  isMutating?: boolean;
};

export default function NotificationItem({ item, onOpen, onToggleRead, onMuteSource, isMutating }: NotificationItemProps) {
  const relativeTime = useMemo(() => formatRelativeTime(item.createdAt), [item.createdAt]);
  const actorInitials = useMemo(() => {
    if (!item.actor) {
      return "";
    }
    const name = item.actor.displayName || item.actor.email || "Usuário";
    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase())
      .join("");
    return initials || name.charAt(0).toUpperCase();
  }, [item.actor]);

  const isUnread = item.status === "unread";

  return (
    <li
      className={clsx(styles.item)}
      data-unread={isUnread}
      role="button"
      tabIndex={0}
      aria-pressed={!isUnread}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className={styles.avatar} aria-hidden>
        {item.actor ? (
          <Avatar
            size={Avatar.sizes.SMALL}
            type={item.actor.avatarUrl ? Avatar.types.IMG : Avatar.types.TEXT}
            src={item.actor.avatarUrl ?? undefined}
            text={!item.actor.avatarUrl ? actorInitials : undefined}
          />
        ) : (
          <Avatar size={Avatar.sizes.SMALL} type={Avatar.types.TEXT} text="?" />
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.metaRow}>
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD} className={styles.title} aria-label={item.title ?? "Notificação"}>
            {item.title ?? "Notificação"}
          </Text>
          <Text type={Text.types.TEXT3} className={styles.time} aria-label={relativeTime}>
            {relativeTime}
          </Text>
        </div>
        <p className={styles.snippet}>{renderWithMentions(item.snippet)}</p>
      </div>
      <div className={styles.menuArea}>
        <MenuButton
          ariaLabel="Ações da notificação"
          size={MenuButton.sizes.SMALL}
          closeMenuOnItemClick
          disabled={isMutating}
          component={() => (
            <IconButton
              icon={MoreBelow}
              kind={IconButton.kinds.TERTIARY}
              size={IconButton.sizes.SMALL}
              ariaLabel="Abrir ações da notificação"
            />
          )}
        >
          <Menu>
            <MenuItem
              title={isUnread ? "Marcar como lida" : "Marcar como não lida"}
              icon={isUnread ? Show : Hide}
              onClick={(event) => {
                event.stopPropagation();
                onToggleRead(item, isUnread ? "read" : "unread");
              }}
            />
            <MenuItem
              title="Abrir em nova aba"
              icon={NewTab}
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
            />
            <MenuItem
              title="Silenciar origem"
              icon={Mute}
              onClick={(event) => {
                event.stopPropagation();
                onMuteSource(item, "source");
              }}
            />
            <MenuItem
              title="Silenciar este tipo"
              icon={NotificationsMuted}
              onClick={(event) => {
                event.stopPropagation();
                onMuteSource(item, "type");
              }}
            />
          </Menu>
        </MenuButton>
      </div>
    </li>
  );
}
