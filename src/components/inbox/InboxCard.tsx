"use client";

import { useMemo } from "react";
import { Avatar, Checkbox, IconButton, Text } from "@vibe/core";
import { NewTab } from "@vibe/icons";
import clsx from "clsx";
import type { InboxItemDTO } from "@/types/inbox";
import { formatRelativeTime } from "@/lib/notifications/utils";
import styles from "./inbox-card.module.css";

type InboxCardProps = {
  item: InboxItemDTO;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
  onOpen: (item: InboxItemDTO) => void;
};

function renderSnippet(snippet?: string | null) {
  if (!snippet) {
    return null;
  }
  const parts = snippet.split(/(\@[a-zA-Z0-9_.-]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span key={`mention-${index}`} className={styles.mention}>
          {part}
        </span>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

export default function InboxCard({ item, selected, onSelectChange, onOpen }: InboxCardProps) {
  const actorInitials = useMemo(() => {
    if (!item.actor?.name) {
      return "?";
    }
    return item.actor.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase())
      .join("");
  }, [item.actor?.name]);

  const relativeTime = useMemo(() => formatRelativeTime(item.createdAt), [item.createdAt]);

  return (
    <article
      className={clsx(styles.card)}
      data-unread={item.isUnread}
      data-selected={selected}
      tabIndex={0}
      role="button"
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className={styles.checkboxArea}>
        <Checkbox
          className={styles.checkbox}
          checked={selected}
          aria-label={`Selecionar atualização ${item.title ?? item.snippet ?? "sem título"}`}
          onChange={(event) => {
            event.stopPropagation();
            onSelectChange(!selected);
          }}
        />
      </div>
      <div className={styles.avatar} aria-hidden>
        <Avatar
          size={Avatar.sizes.SMALL}
          type={item.actor?.avatarUrl ? Avatar.types.IMG : Avatar.types.TEXT}
          src={item.actor?.avatarUrl ?? undefined}
          text={item.actor?.avatarUrl ? undefined : actorInitials}
        />
      </div>
      <div className={styles.content}>
        <header className={styles.header}>
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD} className={styles.actor}>
            {item.actor?.name ?? "Alguém"}
          </Text>
          <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY} className={styles.time}>
            {relativeTime}
          </Text>
        </header>
        {item.title ? (
          <Text type={Text.types.TEXT2} className={styles.title} weight={Text.weights.MEDIUM}>
            {item.title}
          </Text>
        ) : null}
        <p className={styles.snippet}>{renderSnippet(item.snippet)}</p>
      </div>
      <div className={styles.actions}>
        <IconButton
          icon={NewTab}
          ariaLabel="Abrir atualização"
          kind={IconButton.kinds.TERTIARY}
          size={IconButton.sizes.SMALL}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(item);
          }}
        />
      </div>
    </article>
  );
}
