import type { InboxItemDTO } from "@/types/inbox";

export type InboxViewRow = {
  id: string;
  org_id: string;
  user_id: string;
  created_at: string;
  type?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  actor_id?: string | null;
  title?: string | null;
  snippet?: string | null;
  link?: string | null;
  status?: string | null;
  read_at?: string | null;
  board_id?: string | null;
  board_label?: string | null;
  actor_email?: string | null;
  actor_meta?: Record<string, unknown> | null;
  actor_display_name?: string | null;
  actor_avatar_url?: string | null;
};

export function mapInboxRow(row: InboxViewRow, isBookmarked: boolean): InboxItemDTO {
  const boardLabel = row.board_label ?? undefined;
  const actorName = row.actor_display_name ?? row.actor_email ?? "Usuário";
  const link = row.link ?? null;
  const status = row.status ?? "read";

  return {
    id: row.id,
    actor: row.actor_id
      ? {
          id: row.actor_id,
          name: actorName,
          avatarUrl: row.actor_avatar_url ?? undefined,
        }
      : row.actor_email || actorName
      ? {
          id: null,
          name: actorName,
          avatarUrl: row.actor_avatar_url ?? undefined,
        }
      : null,
    title: row.title,
    snippet: row.snippet,
    richText: null,
    link,
    createdAt: row.created_at,
    isUnread: status === "unread",
    isMention: row.type === "mention",
    board: boardLabel
      ? {
          id: row.board_id ?? undefined,
          label: boardLabel,
        }
      : null,
    isBookmarked: isBookmarked || undefined,
  };
}
