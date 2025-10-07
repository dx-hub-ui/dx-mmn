import { describe, expect, it } from "vitest";
import { normalizeBrazilPhone } from "../../contacts/validation/phone";

describe("normalizeBrazilPhone", () => {
  it("normaliza celulares com DDI omitido", () => {
    const result = normalizeBrazilPhone("(11) 98888-7766");
    expect(result).toEqual({
      success: true,
      e164: "+5511988887766",
      nationalNumber: "11988887766",
      areaCode: "11",
    });
  });

  it("rejeita números curtos", () => {
    const result = normalizeBrazilPhone("11 9999-123");
    expect(result).toEqual({ success: false, reason: "too_short" });
  });

  it("rejeita DDD inválido", () => {
    const result = normalizeBrazilPhone("00 98888-7766");
    expect(result).toEqual({ success: false, reason: "invalid_area" });
  });

  it("aceita telefones com +55", () => {
    const result = normalizeBrazilPhone("+55 (21) 3232-8899");
    expect(result).toEqual({
      success: true,
      e164: "+552132328899",
      nationalNumber: "2132328899",
      areaCode: "21",
    });
  });
});
