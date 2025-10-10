export type NotificationStatus = "unread" | "read" | "hidden";
export type NotificationType = "mention" | "assignment" | "automation" | string;

export type NotificationActor = {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
};

export type NotificationItemDTO = {
  id: string;
  orgId: string;
  userId: string;
  type: NotificationType;
  sourceType: string;
  sourceId: string;
  actor: NotificationActor | null;
  title: string | null;
  snippet: string | null;
  link: string | null;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
};

export type NotificationTab = "all" | "unread" | "mentions" | "assigned";

export type NotificationResponse = {
  items: NotificationItemDTO[];
  nextCursor?: string;
  unreadCount: number;
};

export type NotificationCountResponse = {
  unreadCount: number;
};

export type NotificationMuteScope = "source" | "type";
