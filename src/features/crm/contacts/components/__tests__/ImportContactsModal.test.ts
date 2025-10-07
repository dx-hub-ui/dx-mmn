import { describe, expect, it } from "vitest";
import { parseCsv } from "../ImportContactsModal";

describe("parseCsv", () => {
  it("interpreta delimitador por ponto e vírgula", () => {
    const csv = "nome;telefone\nAna;5511999999999\n";
    expect(parseCsv(csv)).toEqual([
      ["nome", "telefone"],
      ["Ana", "5511999999999"],
    ]);
  });

  it("preserva valores entre aspas com vírgulas e quebras de linha", () => {
    const csv = 'nome,email\n"Silva, Jr.","linha 1\nlinha 2"\n';
    expect(parseCsv(csv)).toEqual([
      ["nome", "email"],
      ["Silva, Jr.", "linha 1\nlinha 2"],
    ]);
  });
});
