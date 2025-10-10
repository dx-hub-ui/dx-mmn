import { NotificationItemDTO } from "@/types/notifications";

export type NotificationCursor = {
  createdAt: string;
  id: string;
};

const CURSOR_SEPARATOR = "|";

function base64UrlEncode(value: string) {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window
      .btoa(value)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return window.atob(normalized);
  }

  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeCursor(cursor: NotificationCursor): string {
  const payload = `${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.id}`;
  return base64UrlEncode(payload);
}

export function decodeCursor(cursor: string | null): NotificationCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = base64UrlDecode(cursor);
    const [createdAt, id] = decoded.split(CURSOR_SEPARATOR);
    if (!createdAt || !id) {
      return null;
    }
    return { createdAt, id };
  } catch {
    return null;
  }
}

export type GroupedNotifications = {
  label: string;
  items: NotificationItemDTO[];
};

function isWithinLastDays(timestamp: string, days: number) {
  const now = Date.now();
  const target = new Date(timestamp).getTime();
  if (Number.isNaN(target)) {
    return false;
  }
  const diff = now - target;
  return diff <= days * 24 * 60 * 60 * 1000;
}

export function groupNotifications(items: NotificationItemDTO[]): GroupedNotifications[] {
  const recent: NotificationItemDTO[] = [];
  const older: NotificationItemDTO[] = [];

  items.forEach((item) => {
    if (isWithinLastDays(item.createdAt, 7)) {
      recent.push(item);
    } else {
      older.push(item);
    }
  });

  const groups: GroupedNotifications[] = [];

  if (recent.length > 0) {
    groups.push({ label: "Últimos 7 dias", items: recent });
  }

  if (older.length > 0) {
    groups.push({ label: "Mais antigas", items: older });
  }

  return groups;
}

export function limitPerSource(
  items: NotificationItemDTO[],
  limit = 10
): Record<string, NotificationItemDTO[]> {
  const grouped: Record<string, NotificationItemDTO[]> = {};

  items.forEach((item) => {
    const bucket = grouped[item.sourceType] ?? [];
    if (bucket.length < limit) {
      bucket.push(item);
    }
    grouped[item.sourceType] = bucket;
  });

  return grouped;
}

export function formatRelativeTime(timestamp: string, locale = "pt-BR"): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const absDiff = Math.abs(diff);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absDiff < hour) {
    const value = Math.round(diff / minute);
    return rtf.format(value, "minute");
  }

  if (absDiff < day) {
    const value = Math.round(diff / hour);
    return rtf.format(value, "hour");
  }

  const value = Math.round(diff / day);
  return rtf.format(value, "day");
}
