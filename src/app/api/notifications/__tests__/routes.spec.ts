import { describe, expect, it, beforeEach, vi } from "vitest";

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

const mockedCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockedEnsureOrgMembership = vi.mocked(ensureOrgMembership);

function buildSelectMock<T>(data: T, error: any = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn(),
  } as any;
}

describe("notifications API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnsureOrgMembership.mockResolvedValue({ user: { id: "user-1" } } as any);
  });

  describe("count", () => {
    it("retorna contador de não lidas", async () => {
      const counterBuilder = buildSelectMock({ unread_count: 3 });
      const supabaseMock: any = {
        from: vi.fn().mockReturnValue(counterBuilder),
      };
      mockedCreateSupabaseServerClient.mockReturnValue(supabaseMock);
      const { GET } = await import("../count/route");
      const response = await GET(new Request("http://localhost/api/notifications/count?orgId=org"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.unreadCount).toBe(3);
      expect(counterBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    });
  });

  describe("read", () => {
    it("atualiza status de notificações", async () => {
      const updateChain: any = { update: vi.fn(), in: vi.fn(), eq: vi.fn() };
      updateChain.update.mockReturnValue(updateChain);
      updateChain.in.mockReturnValue(updateChain);
      updateChain.eq
        .mockImplementationOnce(() => updateChain)
        .mockImplementationOnce(() => Promise.resolve({ error: null }));
      const supabaseMock: any = {
        from: vi.fn().mockReturnValue(updateChain),
      };
      mockedCreateSupabaseServerClient.mockReturnValue(supabaseMock);
      const { POST } = await import("../read/route");
      const response = await POST(
        new Request("http://localhost/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            ids: ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "cccccccc-cccc-cccc-cccc-cccccccccccc"],
            status: "read",
          }),
        })
      );
      expect(response.status).toBe(200);
      expect(updateChain.update).toHaveBeenCalledWith({ status: "read", read_at: expect.any(String) });
      expect(updateChain.in).toHaveBeenCalledWith("id", [
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "cccccccc-cccc-cccc-cccc-cccccccccccc",
      ]);
    });
  });

  describe("mark-all-read", () => {
    it("marca todas como lidas", async () => {
      const updateChain: any = { update: vi.fn(), eq: vi.fn() };
      updateChain.update.mockReturnValue(updateChain);
      updateChain.eq
        .mockImplementationOnce(() => updateChain)
        .mockImplementationOnce(() => updateChain)
        .mockImplementationOnce(() => Promise.resolve({ error: null }));
      const supabaseMock: any = {
        from: vi.fn().mockReturnValue(updateChain),
      };
      mockedCreateSupabaseServerClient.mockReturnValue(supabaseMock);
      const { POST } = await import("../mark-all-read/route");
      const response = await POST(
        new Request("http://localhost/api/notifications/mark-all-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }),
        })
      );
      expect(response.status).toBe(200);
      expect(updateChain.update).toHaveBeenCalledWith({ status: "read", read_at: expect.any(String) });
    });
  });

  describe("mute", () => {
    it("cria mute quando não existe", async () => {
      const selectChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn(),
      };
      const insertReturn = {
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "mute" }, error: null }),
        }),
      };
      selectChain.insert.mockReturnValue(insertReturn);
      const supabaseMock: any = {
        from: vi.fn().mockReturnValue(selectChain),
      };
      mockedCreateSupabaseServerClient.mockReturnValue(supabaseMock);
      const { POST } = await import("../mute/route");
      const response = await POST(
        new Request("http://localhost/api/notifications/mute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            scope: "type",
            type: "mention",
          }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });
});
