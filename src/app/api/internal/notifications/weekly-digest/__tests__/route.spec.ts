import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/notifications/pipeline", () => ({
  sendWeeklyMentionDigestEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/telemetry.server", () => ({
  trackServerEvent: vi.fn().mockResolvedValue(undefined),
}));

const { createSupabaseServiceClient } = await import("@/lib/supabase/service");
const mockedCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

describe("weekly digest webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_WEBHOOK_SECRET = "secret";
  });

  it("nega acesso quando segredo inválido", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/internal/notifications/weekly-digest", {
        method: "POST",
        headers: { "x-internal-secret": "other", "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            user_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            timezone: "UTC",
            email: "demo@example.com",
            full_name: "Demo",
          },
        }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("envia e-mail quando há notificações", async () => {
    const supabaseMock: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "n1",
              type: "mention",
              source_type: "comment",
              source_id: "c1",
              title: "Você foi citado",
              snippet: "@demo veja isto",
              link: "https://app.local/comment",
              created_at: new Date().toISOString(),
              actor: { id: "actor", email: "actor@example.com", raw_user_meta_data: { full_name: "Líder" } },
            },
          ],
          error: null,
        }),
      }),
    };
    mockedCreateSupabaseServiceClient.mockReturnValue(supabaseMock);
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/internal/notifications/weekly-digest", {
        method: "POST",
        headers: { "x-internal-secret": "secret", "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            user_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            timezone: "UTC",
            email: "demo@example.com",
            full_name: "Demo",
          },
        }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.delivered).toBe(true);
  });
});
