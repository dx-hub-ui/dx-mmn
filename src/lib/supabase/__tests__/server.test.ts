import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: {} })),
}));

vi.mock("next/headers", () => {
  const cookieStore = new Map<string, { value: string }>();

  return {
    cookies: vi.fn(() => ({
      get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)!.value } : undefined),
      set: ({ name, value }: { name: string; value: string }) => {
        cookieStore.set(name, { value });
      },
    })),
  };
});

describe("createSupabaseServerClient", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it("throws SupabaseConfigurationError when env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { createSupabaseServerClient } = await import("../server");
    expect(() => createSupabaseServerClient()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("returns a client when env vars exist", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const { createSupabaseServerClient } = await import("../server");
    expect(createSupabaseServerClient()).toBeDefined();
  });
});
