"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  BreadcrumbItem,
  BreadcrumbsBar,
  Button,
  Label,
  Search,
} from "@vibe/core";
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

  const statusTotals = useMemo(
    () =>
      sequences.reduce<Record<SequenceStatus | "total", number>>(
        (acc, item) => {
          acc.total += 1;
          acc[item.status] += 1;
          return acc;
        },
        { total: 0, active: 0, paused: 0, draft: 0, archived: 0 }
      ),
    [sequences]
  );

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
        <BreadcrumbsBar type={BreadcrumbsBar.types.NAVIGATION} className={styles.breadcrumbs}>
          <BreadcrumbItem text="Workspaces" />
          <BreadcrumbItem text={organizationName} />
          <BreadcrumbItem text="Sequências" isCurrent />
        </BreadcrumbsBar>

        <div className={styles.headerContent}>
          <div className={styles.headerText}>
            <div className={styles.titleRow}>
              <h1 id="sequence-manager-title">Sequências</h1>
              <Label
                kind={Label.kinds.FILL}
                color={Label.colors.PRIMARY}
                className={styles.betaLabel}
                text="Beta"
              />
            </div>
            <p>
              Crie cadências multicanal e acompanhe o progresso das automações da organização {organizationName}.
            </p>
          </div>

          <dl className={styles.metrics} aria-label="Resumo das sequências">
            <div>
              <dt>Total</dt>
              <dd>{statusTotals.total}</dd>
            </div>
            <div>
              <dt>Ativas</dt>
              <dd>{statusTotals.active}</dd>
            </div>
            <div>
              <dt>Pausadas</dt>
              <dd>{statusTotals.paused}</dd>
            </div>
            <div>
              <dt>Rascunhos</dt>
              <dd>{statusTotals.draft}</dd>
            </div>
            <div>
              <dt>Arquivadas</dt>
              <dd>{statusTotals.archived}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className={styles.pageBody}>
        <div className={styles.toolbar} role="toolbar" aria-label="Controles de sequências">
          <div className={styles.toolbarPrimary}>
            <Button
              kind={Button.kinds.PRIMARY}
              leftIcon="Add"
              onClick={() => router.push("/sequences/new")}
            >
              Nova sequência
            </Button>
            <Button kind={Button.kinds.SECONDARY} leftIcon="Filter" disabled>
              Filtrar
            </Button>
          </div>

          <div className={styles.toolbarFilters}>
            <label className={styles.filterLabel} htmlFor="sequence-status-filter">
              Status
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
                    ? "Todos"
                    : statusLabel[option as SequenceStatus]}
                </option>
              ))}
            </select>

            <label className={styles.filterLabel} htmlFor="sequence-target-filter">
              Alvo
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
                  {option === "todos" ? "Todos" : targetLabel[option as SequenceTargetType]}
                </option>
              ))}
            </select>

            <Search
              value={filters.search}
              placeholder="Buscar por sequência, status ou tipo"
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
              className={styles.search}
            />
          </div>
        </div>

        {selectionCount > 0 ? (
          <div className={styles.selectionBanner} role="status" aria-live="polite">
            <div className={styles.selectionInfo}>
              <span>{selectionCount} sequência(s) selecionada(s)</span>
            </div>
            <div className={styles.selectionActions}>
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

        <div className={styles.tableCard} role="region" aria-live="polite">
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
                  <th className={styles.checkboxCell} scope="col">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as sequências filtradas"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th scope="col">Sequência</th>
                  <th scope="col">Status</th>
                  <th scope="col">Alvo padrão</th>
                  <th scope="col">Passos</th>
                  <th scope="col">Inscrições ativas</th>
                  <th scope="col">Conclusão</th>
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
                      <span className={styles.sequenceName}>{item.name}</span>
                      <span className={styles.sequenceMeta}>Versão #{item.activeVersionNumber || 1}</span>
                    </th>
                    <td>
                      <span className={clsx(styles.badge, badgeClass[item.status])}>{statusLabel[item.status]}</span>
                    </td>
                    <td className={styles.metaCell}>
                      <span>{targetLabel[item.targetType]}</span>
                    </td>
                    <td>{item.stepsTotal}</td>
                    <td>{item.activeEnrollments}</td>
                    <td>{item.completionRate.toFixed(1)}%</td>
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
