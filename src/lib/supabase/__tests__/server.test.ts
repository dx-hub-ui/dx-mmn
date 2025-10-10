import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: {} })),
}));

const cookieStore = new Map<string, { value: string }>();

const store = {
  get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)!.value } : undefined),
  set: vi.fn(({ name, value }: { name: string; value: string }) => {
    cookieStore.set(name, { value });
  }),
  delete: vi.fn((input: string | { name: string }) => {
    const name = typeof input === "string" ? input : input.name;
    cookieStore.delete(name);
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => store),
  __mockCookieStore: store,
}));

describe("createSupabaseServerClient", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    store.set.mockReset();
    store.delete.mockReset();
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

  it("ignores cookie mutations when the runtime forbids it", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { createSupabaseServerClient } = await import("../server");

    expect(() => createSupabaseServerClient()).not.toThrow();

    const { createServerClient } = await import("@supabase/ssr");
    const mockedCreateServerClient = vi.mocked(createServerClient);
    const options = mockedCreateServerClient.mock.calls.at(-1)?.[2];

    expect(options).toBeDefined();

    const headersModule: any = await import("next/headers");
    headersModule.__mockCookieStore.set.mockImplementationOnce(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });

    expect(() => options?.cookies.set("sb-test", "value", { path: "/" })).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      "[createSupabaseServerClient] Ignoring cookie mutation (set) outside of a Server Action/Route Handler.",
      expect.any(Error)
    );

    expect(() => options?.cookies.remove("sb-test", { path: "/" })).not.toThrow();

    warnSpy.mockRestore();
  });
});
