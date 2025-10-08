import { describe, expect, it } from "vitest";
import { calculateDueDate, type WorkWindowConfig } from "../dates";

const BASE_WINDOW: WorkWindowConfig = {
  timeZone: "America/Sao_Paulo",
  workDays: [1, 2, 3, 4, 5],
  workStartTime: "09:00",
  workEndTime: "18:00",
  clampEnabled: true,
};

describe("calculateDueDate", () => {
  it("aplica offsets mantendo-se dentro da janela", () => {
    const result = calculateDueDate("2024-05-13T12:00:00.000Z", 0, 2, BASE_WINDOW);
    expect(result).toBe("2024-05-13T14:00:00.000Z");
  });

  it("clampa para o início quando antes do horário útil", () => {
    const result = calculateDueDate("2024-05-13T00:00:00.000Z", 0, 1, BASE_WINDOW);
    expect(result).toBe("2024-05-13T09:00:00.000Z");
  });

  it("empurra para o próximo dia útil quando após o fim", () => {
    const result = calculateDueDate("2024-05-13T17:00:00.000Z", 0, 5, BASE_WINDOW);
    expect(result).toBe("2024-05-14T09:00:00.000Z");
  });

  it("pula fins de semana", () => {
    const result = calculateDueDate("2024-05-10T17:00:00.000Z", 0, 5, BASE_WINDOW);
    expect(result).toBe("2024-05-13T09:00:00.000Z");
  });

  it("desativa clamp quando indicado", () => {
    const result = calculateDueDate("2024-05-13T23:00:00.000Z", 0, 3, {
      ...BASE_WINDOW,
      clampEnabled: false,
    });
    expect(result).toBe("2024-05-14T02:00:00.000Z");
  });

  it("lança erro para datas inválidas", () => {
    expect(() => calculateDueDate("invalid", 0, 0, BASE_WINDOW)).toThrow("data de inscrição inválida");
  });
});
