import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/notifications/server", () => ({
  ensureOrgMembership: vi.fn(),
  HttpError: class HttpError extends Error {
    public status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/telemetry.server", () => ({
  trackServerEvent: vi.fn().mockResolvedValue(undefined),
}));

const { createSupabaseServerClient } = await import("@/lib/supabase/server");
const { ensureOrgMembership } = await import("@/lib/notifications/server");

const mockedCreateClient = vi.mocked(createSupabaseServerClient);
const mockedEnsureMembership = vi.mocked(ensureOrgMembership);

describe("/api/inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnsureMembership.mockResolvedValue({ user: { id: "user-1" } } as any);
  });

  it("retorna itens formatados", async () => {
    const listBuilder: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
    };
    listBuilder.then = (resolve: (value: { data: any[]; error: null }) => void) =>
      resolve({
        data: [
          {
            id: "notif-1",
            org_id: "org-1",
            user_id: "user-1",
            type: "mention",
            source_type: "comment",
            source_id: "source-1",
            actor_id: "actor-1",
            title: "Nova menção",
            snippet: "@rep veja isso",
            link: "https://example.com",
            status: "unread",
            created_at: "2024-07-01T00:00:00Z",
            read_at: null,
            board_id: null,
            board_label: "Comment",
            actor_email: "actor@example.com",
            actor_meta: null,
            actor_display_name: "Actor",
            actor_avatar_url: null,
          },
        ],
        error: null,
      });

    const bookmarkBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data: any[]; error: null }) => void) =>
        resolve({ data: [{ notification_id: "notif-1" }], error: null }),
    };

    const countAllBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (resolve: (value: { count: number; error: null }) => void) =>
        resolve({ count: 1, error: null }),
    };

    const countWithoutBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (resolve: (value: { count: number; error: null }) => void) =>
        resolve({ count: 0, error: null }),
    };

    const countersBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { unread_count: 2 }, error: null }),
    };

    const fromMock = vi
      .fn()
      .mockImplementationOnce(() => listBuilder)
      .mockImplementationOnce(() => bookmarkBuilder)
      .mockImplementationOnce(() => countAllBuilder)
      .mockImplementationOnce(() => countWithoutBuilder)
      .mockImplementationOnce(() => countersBuilder);

    countAllBuilder.select = vi.fn().mockReturnThis();
    countAllBuilder.eq = vi.fn().mockReturnThis();
    countAllBuilder.is = vi.fn().mockReturnThis();
    countAllBuilder.then = (resolve: (value: { count: number; error: null }) => void) =>
      resolve({ count: 1, error: null });

    countWithoutBuilder.select = vi.fn().mockReturnThis();
    countWithoutBuilder.eq = vi.fn().mockReturnThis();
    countWithoutBuilder.is = vi.fn().mockReturnThis();
    countWithoutBuilder.then = (resolve: (value: { count: number; error: null }) => void) =>
      resolve({ count: 0, error: null });

    mockedCreateClient.mockReturnValue({ from: fromMock } as any);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/inbox?orgId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: "notif-1", isUnread: true, isBookmarked: true });
    expect(body.counts).toEqual({ all: 1, without: 0 });
    expect(body.unreadCount).toBe(2);
  });

  it("marca itens como lidos", async () => {
    const updateBuilder: any = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    updateBuilder.eq
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(Promise.resolve({ error: null }));

    const countersBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { unread_count: 0 }, error: null }),
    };

    const fromMock = vi
      .fn()
      .mockImplementationOnce(() => updateBuilder)
      .mockImplementationOnce(() => countersBuilder);
    mockedCreateClient.mockReturnValue({ from: fromMock } as any);

    const { POST } = await import("../mark-read/route");
    const response = await POST(
      new Request("http://localhost/api/inbox/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          ids: ["00000000-0000-0000-0000-000000000001"],
        }),
      })
    );
    const body = await response.json();
    if (response.status !== 200) {
      throw new Error(`status ${response.status} body ${JSON.stringify(body)}`);
    }
    expect(body.unreadCount).toBe(0);
    expect(updateBuilder.update).toHaveBeenCalled();
  });
});
