import { describe, expect, it, vi } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  formatRelativeTime,
  groupNotifications,
} from "@/lib/notifications/utils";
import type { NotificationItemDTO } from "@/types/notifications";

describe("notifications utils", () => {
  it("encodes e decodifica cursor", () => {
    const cursor = { createdAt: "2024-05-19T12:00:00.000Z", id: "abc" };
    const encoded = encodeCursor(cursor);
    expect(encoded).toBeTypeOf("string");
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(cursor);
  });

  it("retorna null para cursor inválido", () => {
    expect(decodeCursor("invalid")).toBeNull();
  });

  it("agrupa notificações por recência", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const items: NotificationItemDTO[] = [
      {
        id: "1",
        orgId: "org",
        userId: "user",
        type: "mention",
        sourceType: "comment",
        sourceId: "a",
        actor: null,
        title: "Recente",
        snippet: null,
        link: null,
        status: "unread",
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: null,
      },
      {
        id: "2",
        orgId: "org",
        userId: "user",
        type: "mention",
        sourceType: "comment",
        sourceId: "b",
        actor: null,
        title: "Antiga",
        snippet: null,
        link: null,
        status: "unread",
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: null,
      },
    ];

    const groups = groupNotifications(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Últimos 7 dias");
    expect(groups[0].items).toHaveLength(1);
    expect(groups[1].label).toBe("Mais antigas");
    vi.useRealTimers();
  });

  it("formata tempo relativo em pt-BR", () => {
    vi.useFakeTimers();
    const base = new Date("2024-05-19T12:00:00.000Z");
    vi.setSystemTime(base.getTime());
    expect(formatRelativeTime("2024-05-19T11:00:00.000Z")).toBe("há 1 hora");
    expect(formatRelativeTime("2024-05-20T12:00:00.000Z")).toBe("amanhã");
    vi.useRealTimers();
  });
});
