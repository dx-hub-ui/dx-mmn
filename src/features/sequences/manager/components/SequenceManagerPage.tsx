"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Button } from "@vibe/core";
import { trackEvent } from "@/lib/telemetry";
import { useSentrySequenceScope } from "@/lib/observability/sentryClient";
import { filterSequences } from "../normalize";
import type {
  SequenceManagerFilters,
  SequenceManagerItem,
  SequenceStatus,
  SequenceTargetType,
} from "../types";
import styles from "./sequence-manager.module.css";

const STATUS_OPTIONS: (SequenceStatus | "todos")[] = ["todos", "active", "paused", "draft", "archived"];
const TARGET_OPTIONS: (SequenceTargetType | "todos")[] = ["todos", "contact", "member"];

type SequenceManagerPageProps = {
  sequences: SequenceManagerItem[];
  orgId: string;
  organizationName: string;
  membershipRole: "org" | "leader" | "rep";
};

type SelectionState = Set<string>;

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export default function SequenceManagerPage({ sequences, orgId, organizationName, membershipRole }: SequenceManagerPageProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<SequenceManagerFilters>({
    search: "",
    status: "todos",
    targetType: "todos",
  });

  const [selection, setSelection] = useState<SelectionState>(() => new Set());

  useEffect(() => {
    trackEvent(
      "sequence_manager_viewed",
      { total: sequences.length, role: membershipRole },
      { groups: { orgId } }
    );
  }, [membershipRole, orgId, sequences.length]);

  useSentrySequenceScope(
    { orgId },
    {
      message: "sequence_manager_viewed",
      data: { total: sequences.length },
    }
  );

  useEffect(() => {
    setSelection(new Set());
  }, [filters.status, filters.targetType, filters.search]);

  const filtered = useMemo(() => filterSequences(sequences, filters), [sequences, filters]);

  const allSelected = filtered.length > 0 && filtered.every((item) => selection.has(item.id));
  const selectionCount = selection.size;

  function toggleSelection(sequenceId: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(sequenceId)) {
        next.delete(sequenceId);
      } else {
        next.add(sequenceId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelection((prev) => {
      if (filtered.length === 0) {
        return new Set();
      }

      const allSelectedNow = filtered.every((item) => prev.has(item.id));
      if (allSelectedNow) {
        return new Set();
      }

      return new Set(filtered.map((item) => item.id));
    });
  }

  const statusLabel: Record<SequenceStatus, string> = {
    active: "Ativa",
    paused: "Pausada",
    draft: "Rascunho",
    archived: "Arquivada",
  };

  const targetLabel: Record<SequenceTargetType, string> = {
    contact: "Contato",
    member: "Membro",
  };

  const badgeClass: Record<SequenceStatus, string> = {
    active: styles.badgeActive,
    paused: styles.badgePaused,
    draft: styles.badgeDraft,
    archived: styles.badgeArchived,
  };

  return (
    <section className={styles.page} aria-labelledby="sequence-manager-title">
      <header className={styles.pageHeader}>
        <h1 id="sequence-manager-title" className={styles.pageTitle}>
          Sequências de Tarefas
        </h1>
        <p className={styles.pageSubtitle}>
          Organize e monitore todas as automações da organização {organizationName}.
        </p>
      </header>

      <div className={styles.pageBody}>
        <div className={styles.filters} role="toolbar" aria-label="Filtros da lista de sequências">
          <label className="sr-only" htmlFor="sequence-search">
            Buscar sequência
          </label>
          <input
            id="sequence-search"
            className={styles.searchInput}
            placeholder="Buscar por nome, status ou tipo de alvo"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />

          <label className="sr-only" htmlFor="sequence-status-filter">
            Filtrar por status
          </label>
          <select
            id="sequence-status-filter"
            className={styles.select}
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value as SequenceStatus | "todos" }))
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "todos"
                  ? "Todos os status"
                  : `Status: ${statusLabel[option as SequenceStatus]}`}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="sequence-target-filter">
            Filtrar por tipo de alvo
          </label>
          <select
            id="sequence-target-filter"
            className={styles.select}
            value={filters.targetType}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, targetType: event.target.value as SequenceTargetType | "todos" }))
            }
          >
            {TARGET_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "todos" ? "Todos os alvos" : `Alvo: ${targetLabel[option as SequenceTargetType]}`}
              </option>
            ))}
          </select>
        </div>

        {selectionCount > 0 ? (
          <div className={styles.selectionBar} role="status" aria-live="polite">
            <span className={styles.selectionInfo}>{selectionCount} sequências selecionadas</span>
            <div className={styles.actionsRow}>
              <Button kind={Button.kinds.PRIMARY} disabled>
                Ativar
              </Button>
              <Button kind={Button.kinds.SECONDARY} disabled>
                Pausar
              </Button>
              <Button kind={Button.kinds.SECONDARY} disabled>
                Desativar
              </Button>
              <Button kind={Button.kinds.TERTIARY} disabled>
                Arquivar
              </Button>
            </div>
          </div>
        ) : null}

        <div className={styles.tableWrapper} role="region" aria-live="polite">
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyTitle}>Nenhuma sequência encontrada</span>
              <p>Revise os filtros ou crie uma nova sequência para começar.</p>
              <Button kind={Button.kinds.PRIMARY} onClick={() => router.push("/sequences/new")}>
                Nova sequência
              </Button>
            </div>
          ) : (
            <table className={styles.table} role="grid" aria-labelledby="sequence-manager-title">
              <thead>
                <tr>
                  <th className={clsx(styles.checkboxCell)} scope="col">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as sequências filtradas"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th scope="col">Nome</th>
                  <th scope="col">Status</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Steps</th>
                  <th scope="col">Inscritos ativos</th>
                  <th scope="col">Conclusão %</th>
                  <th scope="col">Última ativação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.checkboxCell}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar sequência ${item.name}`}
                        checked={selection.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                      />
                    </td>
                    <th scope="row" className={styles.nameCell}>
                      <span>{item.name}</span>
                    </th>
                    <td>
                      <span className={clsx(styles.badge, badgeClass[item.status])}>{statusLabel[item.status]}</span>
                    </td>
                    <td className={styles.metaCell}>
                      <span>{targetLabel[item.targetType]}</span>
                      <span>Versão #{item.activeVersionNumber || 1}</span>
                    </td>
                    <td>{item.stepsTotal}</td>
                    <td>{item.activeEnrollments}</td>
                    <td>{item.completionRate.toFixed(2)}%</td>
                    <td>{formatDate(item.lastActivationAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
