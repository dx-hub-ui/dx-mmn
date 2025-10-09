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

function buildPreferencesBuilder(pref: any) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: pref, error: null }),
    upsert: vi.fn(),
  } as any;
}

describe("/api/user/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnsureOrgMembership.mockResolvedValue({ user: { id: "user-1" } } as any);
  });

  it("retorna preferências existentes", async () => {
    const builder = buildPreferencesBuilder({ email_on_mention_weekly: false, timezone: "UTC" });
    const supabaseMock: any = { from: vi.fn().mockReturnValue(builder) };
    mockedCreateSupabaseServerClient.mockReturnValue(supabaseMock);
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/user/preferences?orgId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.email_on_mention_weekly).toBe(false);
  });

  it("salva preferências", async () => {
    const builder = buildPreferencesBuilder({ email_on_mention_weekly: true, timezone: "America/Sao_Paulo" });
    builder.upsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { email_on_mention_weekly: true, timezone: "America/Sao_Paulo" }, error: null }),
      }),
    });
    const supabaseMock: any = { from: vi.fn().mockReturnValue(builder) };
    mockedCreateSupabaseServerClient.mockReturnValue(supabaseMock);
    const { PATCH } = await import("../route");
    const response = await PATCH(
      new Request("http://localhost/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          email_on_mention_weekly: true,
          timezone: "America/Sao_Paulo",
        }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.timezone).toBe("America/Sao_Paulo");
  });
});
