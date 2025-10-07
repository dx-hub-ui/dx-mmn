"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@vibe/core";
import {
  CONTACT_STAGES,
  ContactRecord,
  ContactStageId,
  MembershipSummary,
} from "../types";
import { ImportRow, ImportDryRunResult, ImportApplyResult } from "../server/importContacts";
import styles from "./import-modal.module.css";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const stageLookup: Record<string, ContactStageId> = (() => {
  const map: Record<string, ContactStageId> = {};
  CONTACT_STAGES.forEach((stage) => {
    map[stage.id] = stage.id;
    map[normalize(stage.label)] = stage.id;
  });
  return map;
})();

type ParsedRow = {
  index: number;
  raw: Record<string, string>;
  row?: ImportRow;
  parseErrors: string[];
  serverErrors: string[];
};

type ImportContactsModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  actorMembershipId: string;
  memberships: MembershipSummary[];
  onImported: (contacts: ContactRecord[]) => void;
};

const COLUMN_KEYS: Record<string, string[]> = {
  name: ["nome", "name"],
  email: ["e-mail", "email"],
  whatsapp: ["telefone", "telefone/whatsapp", "whatsapp"],
  owner: ["dono", "owner", "responsavel"],
  stage: ["estágio", "stage"],
  source: ["origem", "source"],
  tags: ["tags"],
  score: ["score"],
  nextNote: ["próximo passo", "next step", "next note"],
  nextDate: ["próximo passo data", "next step date", "next date"],
  referredBy: ["indicado por", "referred by"],
  lostReason: ["motivo perda", "lost reason"],
  lostReview: ["revisar em", "review at"],
};

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";

  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\r") {
      continue;
    }
    if (char === '"') {
      const nextChar = text[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if (char === "\n" && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current);
  rows.push(row);
  return rows.filter((columns) => columns.some((value) => value.trim().length > 0));
}

function resolveHeader(headers: string[], keyOptions: string[]): string | null {
  const normalizedMap = new Map(headers.map((header) => [normalize(header), header] as const));
  for (const option of keyOptions) {
    const match = normalizedMap.get(option);
    if (match) {
      return match;
    }
  }
  return null;
}

function buildImportRow(
  record: Record<string, string>,
  memberships: MembershipSummary[],
  actorMembershipId: string
): { row?: ImportRow; errors: string[] } {
  const errors: string[] = [];

  const name = record.name?.trim();
  if (!name) {
    errors.push("Nome é obrigatório");
  }

  let ownerMembershipId = actorMembershipId;
  if (record.owner) {
    const normalizedOwner = record.owner.trim();
    const ownerById = memberships.find((member) => member.id === normalizedOwner);
    const ownerByName = memberships.find((member) => member.displayName.toLowerCase() === normalizedOwner.toLowerCase());
    const ownerByEmail = memberships.find((member) => member.email?.toLowerCase() === normalizedOwner.toLowerCase());
    const resolvedOwner = ownerById ?? ownerByName ?? ownerByEmail;
    if (!resolvedOwner) {
      errors.push(`Dono não encontrado: ${normalizedOwner}`);
    } else {
      ownerMembershipId = resolvedOwner.id;
    }
  }

  let stage: ContactStageId = "novo";
  if (record.stage) {
    const normalizedStage = normalize(record.stage);
    const resolved = stageLookup[normalizedStage];
    if (!resolved) {
      errors.push(`Estágio inválido: ${record.stage}`);
    } else {
      stage = resolved;
    }
  }

  let scoreValue: number | null = null;
  if (record.score) {
    const parsed = Number(record.score.replace(/,/g, "."));
    if (Number.isNaN(parsed)) {
      errors.push(`Score inválido: ${record.score}`);
    } else {
      scoreValue = parsed;
    }
  }

  let nextActionAt: string | null = null;
  if (record.nextDate) {
    const date = new Date(record.nextDate);
    if (Number.isNaN(date.getTime())) {
      errors.push(`Data inválida: ${record.nextDate}`);
    } else {
      nextActionAt = date.toISOString();
    }
  }

  let lostReviewAt: string | null = null;
  if (record.lostReview) {
    const date = new Date(record.lostReview);
    if (Number.isNaN(date.getTime())) {
      errors.push(`Revisar em inválido: ${record.lostReview}`);
    } else {
      lostReviewAt = date.toISOString();
    }
  }

  const tags = record.tags
    ? record.tags
        .split(/[,;]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  if (errors.length > 0) {
    return { errors };
  }

  const row: ImportRow = {
    name,
    email: record.email?.trim() || null,
    whatsapp: record.whatsapp?.trim() || null,
    ownerMembershipId,
    stage,
    source: record.source?.trim() || null,
    tags,
    score: scoreValue,
    nextActionAt,
    nextActionNote: record.nextNote?.trim() || null,
    referredByContactId: record.referredBy?.trim() || null,
    lostReason: record.lostReason?.trim() || null,
    lostReviewAt,
  };

  return { row, errors: [] };
}

const TEMPLATE_CSV =
  "Nome;E-mail;Telefone;Dono;Estágio;Origem;Tags;Score;Próximo passo;Próximo passo data;Indicado por;Motivo perda;Revisar em\n" +
  "Maria Silva;maria@example.com;+55 11 99999-0000;RESPONSAVEL;Novo;manual;vip,sp;80;Enviar proposta;2024-05-18;;;\n";

export default function ImportContactsModal({
  open,
  onClose,
  organizationId,
  actorMembershipId,
  memberships,
  onImported,
}: ImportContactsModalProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [dryRunResult, setDryRunResult] = useState<ImportDryRunResult | null>(null);
  const [applyResult, setApplyResult] = useState<ImportApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setParsedRows([]);
    setDryRunResult(null);
    setApplyResult(null);
    setLoading(false);
    setError(null);
    setFileName(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  const validParsedRows = useMemo(() => parsedRows.filter((row) => row.row), [parsedRows]);

  const hasParseErrors = parsedRows.some((row) => row.parseErrors.length > 0);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setError("Arquivo vazio ou não reconhecido");
      return;
    }

    const [headerRow, ...dataRows] = rows;
    const headers = headerRow.map((header) => header.trim());
    const headerLookup: Record<string, string> = {};
    Object.entries(COLUMN_KEYS).forEach(([key, options]) => {
      const header = resolveHeader(headers, options);
      if (header) {
        headerLookup[key] = header;
      }
    });

    const parsed: ParsedRow[] = dataRows.map((columns, index) => {
      const raw: Record<string, string> = {};
      headers.forEach((header, columnIndex) => {
        raw[normalize(header)] = columns[columnIndex]?.trim() ?? "";
      });

      const record: Record<string, string> = {
        name: headerLookup.name ? raw[normalize(headerLookup.name)] ?? "" : "",
        email: headerLookup.email ? raw[normalize(headerLookup.email)] ?? "" : "",
        whatsapp: headerLookup.whatsapp ? raw[normalize(headerLookup.whatsapp)] ?? "" : "",
        owner: headerLookup.owner ? raw[normalize(headerLookup.owner)] ?? "" : "",
        stage: headerLookup.stage ? raw[normalize(headerLookup.stage)] ?? "" : "",
        source: headerLookup.source ? raw[normalize(headerLookup.source)] ?? "" : "",
        tags: headerLookup.tags ? raw[normalize(headerLookup.tags)] ?? "" : "",
        score: headerLookup.score ? raw[normalize(headerLookup.score)] ?? "" : "",
        nextNote: headerLookup.nextNote ? raw[normalize(headerLookup.nextNote)] ?? "" : "",
        nextDate: headerLookup.nextDate ? raw[normalize(headerLookup.nextDate)] ?? "" : "",
        referredBy: headerLookup.referredBy ? raw[normalize(headerLookup.referredBy)] ?? "" : "",
        lostReason: headerLookup.lostReason ? raw[normalize(headerLookup.lostReason)] ?? "" : "",
        lostReview: headerLookup.lostReview ? raw[normalize(headerLookup.lostReview)] ?? "" : "",
      };

      const { row, errors } = buildImportRow(record, memberships, actorMembershipId);
      return {
        index,
        raw: record,
        row: row ?? undefined,
        parseErrors: errors,
        serverErrors: [],
      };
    });

    setParsedRows(parsed);
    setDryRunResult(null);
    setApplyResult(null);
    setError(null);
    setFileName(file.name);
  }

  async function handleDryRun() {
    setLoading(true);
    setError(null);
    setDryRunResult(null);

    try {
      const response = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          actorMembershipId,
          mode: "dry-run",
          rows: validParsedRows.map((row) => row.row!),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Erro ao simular importação" }));
        throw new Error(payload.error ?? "Erro ao simular importação");
      }

      const result = (await response.json()) as ImportDryRunResult;
      const nextRows = parsedRows.map((row) => ({ ...row, serverErrors: [] as string[] }));
      result.rows.forEach((rowResult, position) => {
        const originalIndex = validParsedRows[position]?.index;
        if (originalIndex != null) {
          nextRows[originalIndex] = {
            ...nextRows[originalIndex],
            serverErrors: rowResult.errors,
            row: rowResult.payload ?? nextRows[originalIndex].row,
          };
        }
      });

      setParsedRows(nextRows);
      setDryRunResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao simular importação");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    setLoading(true);
    setError(null);
    setApplyResult(null);

    try {
      const response = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          actorMembershipId,
          mode: "apply",
          rows: validParsedRows.map((row) => row.row!),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Erro ao importar" }));
        throw new Error(payload.error ?? "Erro ao importar contatos");
      }

      const result = (await response.json()) as ImportApplyResult;
      const nextRows = parsedRows.map((row) => ({ ...row, serverErrors: [] as string[] }));
      result.errors.forEach((item) => {
        const originalIndex = validParsedRows[item.index]?.index;
        if (originalIndex != null) {
          nextRows[originalIndex] = {
            ...nextRows[originalIndex],
            serverErrors: [item.message] as string[],
          };
        }
      });
      setParsedRows(nextRows);
      setApplyResult(result);
      if (result.created.length > 0) {
        onImported(result.created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar contatos");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  const readyForDryRun = parsedRows.length > 0 && !hasParseErrors;
  const canImport = !!dryRunResult && dryRunResult.validCount > 0;

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="import-title">Importar contatos via CSV</h2>
            <div className={styles.steps}>
              <span>1. Carregar arquivo</span>
              <span>•</span>
              <span>2. Simular validação</span>
              <span>•</span>
              <span>3. Importar</span>
            </div>
          </div>
          <Button kind={Button.kinds.TERTIARY} onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className={styles.content}>
          <div className={styles.field}>
            <label htmlFor="import-file">Arquivo CSV</label>
            <input id="import-file" type="file" accept=".csv" onChange={handleFileChange} />
            <small>{fileName ? `Selecionado: ${fileName}` : "Formato recomendado: UTF-8 com separador ; ou ,"}</small>
            <Button
              kind={Button.kinds.TERTIARY}
              type="button"
              onClick={() => {
                const blob = new Blob(["\ufeff", TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "modelo-importacao.csv";
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              Baixar modelo
            </Button>
          </div>

          {parsedRows.length > 0 && (
            <div>
              <div className={styles.summary}>
                {parsedRows.length} linha(s) carregada(s) — {validParsedRows.length} pronta(s) para validação.
              </div>
              {hasParseErrors && (
                <div className={styles.errorList} role="alert">
                  {parsedRows
                    .filter((row) => row.parseErrors.length > 0)
                    .map((row) => (
                      <span key={row.index}>
                        Linha {row.index + 2}: {row.parseErrors.join("; ")}
                      </span>
                    ))}
                </div>
              )}
              <table className={styles.previewTable} aria-label="Pré-visualização da importação">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>Dono</th>
                    <th>Estágio</th>
                    <th>Telefone</th>
                    <th>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((row) => (
                    <tr key={row.index}>
                      <td>{row.index + 2}</td>
                      <td>{row.raw.name}</td>
                      <td>{row.raw.owner || "—"}</td>
                      <td>{row.raw.stage || "—"}</td>
                      <td>{row.raw.whatsapp || "—"}</td>
                      <td>
                        {[...row.parseErrors, ...row.serverErrors].join("; ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 ? <small>Mostrando as 10 primeiras linhas.</small> : null}
            </div>
          )}

          {dryRunResult && (
            <div>
              <div className={styles.summary}>
                Simulação: {dryRunResult.validCount} válida(s), {dryRunResult.invalidCount} inválida(s).
              </div>
              {dryRunResult.rows.some((row) => row.errors.length > 0) && (
                <div className={styles.errorList}>
                  {dryRunResult.rows
                    .filter((row) => row.errors.length > 0)
                    .map((row) => {
                      const originalIndex = validParsedRows[row.index]?.index ?? row.index;
                      return (
                        <span key={row.index}>
                          Linha {originalIndex + 2}: {row.errors.join("; ")}
                        </span>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {applyResult && (
            <div>
              <div className={styles.summary}>
                Importação concluída: {applyResult.created.length} contato(s) criado(s).
              </div>
              {applyResult.errors.length > 0 && (
                <div className={styles.errorList}>
                  {applyResult.errors.map((error, index) => {
                    const originalIndex = validParsedRows[error.index]?.index ?? error.index;
                    return (
                      <span key={`${error.message}-${index}`}>
                        Linha {originalIndex + 2}: {error.message}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {error ? <div className={styles.errorList}>{error}</div> : null}
        </div>

        <div className={styles.footer}>
          <Button kind={Button.kinds.TERTIARY} type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={!readyForDryRun || loading}
            onClick={handleDryRun}
          >
            Simular importação
          </Button>
          <Button kind={Button.kinds.PRIMARY} type="button" disabled={!canImport || loading} onClick={handleApply} loading={loading}>
            Importar
          </Button>
        </div>
      </div>
    </div>
  );
}
