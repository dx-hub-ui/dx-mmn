import { describe, expect, it } from "vitest";
import { normalizeSnoozeInput } from "../validation";

describe("normalizeSnoozeInput", () => {
  it("retorna ISO futuro válido", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const iso = normalizeSnoozeInput(future.toISOString());
    expect(iso).toMatch(/Z$/);
  });

  it("lança erro para vazio", () => {
    expect(() => normalizeSnoozeInput(" ")).toThrowError();
  });

  it("lança erro para data no passado", () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    expect(() => normalizeSnoozeInput(past)).toThrowError();
  });
});
