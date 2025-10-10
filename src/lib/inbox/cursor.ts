import { decodeCursor as decodeNotificationCursor, encodeCursor as encodeNotificationCursor } from "@/lib/notifications/utils";

export type InboxCursor = {
  createdAt: string;
  id: string;
};

export function encodeCursor(cursor: InboxCursor) {
  return encodeNotificationCursor(cursor);
}

export function decodeCursor(cursor: string | null): InboxCursor | null {
  return decodeNotificationCursor(cursor);
}
