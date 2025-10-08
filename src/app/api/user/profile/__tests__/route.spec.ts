import { describe, expect, it, beforeEach, vi } from "vitest";
import { GET, PUT } from "../route";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/blob", () => ({
  uploadAvatarBlob: vi.fn(),
}));
vi.mock("@/lib/telemetry.server", () => ({
  trackServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const { createSupabaseServerClient } = await import("@/lib/supabase/server");
const { uploadAvatarBlob } = await import("@/lib/blob");
const { trackServerEvent } = await import("@/lib/telemetry.server");

const mockedCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockedUploadAvatarBlob = vi.mocked(uploadAvatarBlob);
const mockedTrackServerEvent = vi.mocked(trackServerEvent);

function createBuilder() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
  };
}

describe("/api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna o perfil do usuário autenticado", async () => {
    const mockSupabase: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "ana@example.com" } }, error: null }),
      },
      from: vi.fn(),
    };
    mockedCreateSupabaseServerClient.mockReturnValue(mockSupabase);

    const profilesBuilder = createBuilder();
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: {
        email: "ana@example.com",
        raw_user_meta_data: { display_name: "Ana QA", theme_preference: "night" },
      },
      error: null,
    });
    const membershipsBuilder = createBuilder();
    membershipsBuilder.maybeSingle.mockResolvedValue({
      data: { id: "m1", organization_id: "org1" },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesBuilder;
      }
      if (table === "memberships") {
        return membershipsBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { profile: any };
    expect(body.profile).toMatchObject({
      user_id: "u1",
      email: "ana@example.com",
      org_id: "org1",
      member_id: "m1",
      display_name: "Ana QA",
      theme_preference: "night",
    });
  });

  it("retorna perfil mesmo quando memberships dispara erro de permissão", async () => {
    const mockSupabase: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "ana@example.com" } }, error: null }),
      },
      from: vi.fn(),
    };
    mockedCreateSupabaseServerClient.mockReturnValue(mockSupabase);

    const profilesBuilder = createBuilder();
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: {
        email: "ana@example.com",
        raw_user_meta_data: { display_name: "Ana QA", theme_preference: "dark" },
      },
      error: null,
    });

    const membershipsBuilder = createBuilder();
    membershipsBuilder.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesBuilder;
      }
      if (table === "memberships") {
        return membershipsBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { profile: any };
    expect(body.profile).toMatchObject({
      user_id: "u1",
      member_id: null,
      org_id: null,
    });
    expect(mockedTrackServerEvent).toHaveBeenCalledWith("memberships/fetch_denied", { userId: "u1", code: "42501" });
  });

  it("atualiza dados textuais do perfil", async () => {
    const mockSupabase: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "ana@example.com" } }, error: null }),
      },
      from: vi.fn(),
    };
    mockedCreateSupabaseServerClient.mockReturnValue(mockSupabase);

    const profilesBuilder = createBuilder();
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: {
        email: "ana@example.com",
        raw_user_meta_data: { display_name: "Ana" },
      },
      error: null,
    });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    profilesBuilder.update.mockReturnValue({ eq: updateEq });

    const membershipsBuilder = createBuilder();
    membershipsBuilder.maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesBuilder;
      }
      if (table === "memberships") {
        return membershipsBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const request = new Request("http://localhost/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: " Ana QA ", theme_preference: "dark" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { profile: any };
    expect(body.profile.display_name).toBe("Ana QA");
    expect(body.profile.theme_preference).toBe("dark");
    expect(updateEq).toHaveBeenCalledWith("id", "u1");
    expect(mockedTrackServerEvent).toHaveBeenCalledWith("profile/save_success", { userId: "u1" });
  });

  it("retorna erros de validação", async () => {
    const mockSupabase: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "ana@example.com" } }, error: null }),
      },
      from: vi.fn(),
    };
    mockedCreateSupabaseServerClient.mockReturnValue(mockSupabase);

    const request = new Request("http://localhost/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { errors: Record<string, string> };
    expect(body.errors.display_name).toBeDefined();
  });

  it("envia avatar para o blob e atualiza a URL", async () => {
    const fileData = Uint8Array.from([137, 80, 78, 71]);
    const file = new File([fileData], "avatar.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("display_name", "Usuária");
    formData.append("avatar", file);

    const mockSupabase: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "ana@example.com" } }, error: null }),
      },
      from: vi.fn(),
    };
    mockedCreateSupabaseServerClient.mockReturnValue(mockSupabase);

    const profilesBuilder = createBuilder();
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: {
        email: "ana@example.com",
        raw_user_meta_data: { display_name: "Usuária" },
      },
      error: null,
    });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    profilesBuilder.update.mockReturnValue({ eq: updateEq });

    const membershipsBuilder = createBuilder();
    membershipsBuilder.maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesBuilder;
      }
      if (table === "memberships") {
        return membershipsBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    mockedUploadAvatarBlob.mockResolvedValue("https://blob.example/avatar.png");

    const request = new Request("http://localhost/api/user/profile", {
      method: "PUT",
      headers: { "content-type": "multipart/form-data" },
    });

    Object.defineProperty(request, "formData", {
      value: async () => formData,
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { profile: any };
    expect(body.profile.avatar_url).toBe("https://blob.example/avatar.png");
    expect(mockedUploadAvatarBlob).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ userId: "u1" }));
    expect(mockedTrackServerEvent).toHaveBeenCalledWith(
      "avatar/upload_success",
      expect.objectContaining({ userId: "u1" })
    );
  });
});
