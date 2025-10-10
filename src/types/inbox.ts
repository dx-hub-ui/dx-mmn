export type InboxTab = "all" | "mentions" | "bookmarked" | "account" | "scheduled" | "new";

export type InboxShowFilter = "unread" | "all";

export type InboxBoardFilter = "all" | "without" | { id: string };

export type InboxItemDTO = {
  id: string;
  actor: { id: string | null; name: string; avatarUrl?: string | null } | null;
  title?: string | null;
  snippet?: string | null;
  richText?: string | null;
  link: string | null;
  createdAt: string;
  isUnread: boolean;
  isMention: boolean;
  board: { id?: string; label: string } | null;
  isBookmarked?: boolean;
};

export type InboxCounts = {
  all: number;
  without: number;
};

export type InboxResponse = {
  items: InboxItemDTO[];
  counts: InboxCounts;
  nextCursor?: string;
  unreadCount: number;
};
