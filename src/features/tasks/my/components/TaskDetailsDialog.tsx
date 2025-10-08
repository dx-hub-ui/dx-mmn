"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Button } from "@vibe/core";
import type { MyTaskItem } from "../types";
import styles from "./task-details-dialog.module.css";

function formatDateTime(value: string | null) {
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

function toInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

type TaskDetailsDialogProps = {
  task: MyTaskItem | null;
  open: boolean;
  pendingAction: "complete" | "snooze" | null;
  errorMessage: string | null;
  onClose: () => void;
  onComplete: () => void;
  onSnooze: (value: string) => void;
};

export default function TaskDetailsDialog({
  task,
  open,
  pendingAction,
  errorMessage,
  onClose,
  onComplete,
  onSnooze,
}: TaskDetailsDialogProps) {
  const [snoozeValue, setSnoozeValue] = useState("");

  useEffect(() => {
    if (!task) {
      setSnoozeValue("");
      return;
    }

    if (task.snoozedUntil) {
      setSnoozeValue(toInputValue(task.snoozedUntil));
      return;
    }

    const suggestion = new Date(Date.now() + 60 * 60 * 1000);
    setSnoozeValue(toInputValue(suggestion.toISOString()));
  }, [task]);

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
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const tags = useMemo(() => task?.tags ?? [], [task]);

  if (!open || !task) {
    return null;
  }

  const disableActions = Boolean(pendingAction);

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-details-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="task-details-title">Detalhes da tarefa</h2>
            <p className={styles.subtitle}>{task.sequenceName} › {task.stepTitle}</p>
          </div>
          <Button kind={Button.kinds.TERTIARY} onClick={onClose} size={Button.sizes.SMALL}>
            Fechar
          </Button>
        </header>

        <div className={styles.body}>
          <section className={styles.section} aria-label="Resumo da tarefa">
            <dl className={styles.metaGrid}>
              <div>
                <dt>Status atual</dt>
                <dd className={clsx(styles.pill, styles[`status-${task.status}`])}>{task.status === "done" ? "Concluído" : task.status === "snoozed" ? "Adiado" : task.status === "blocked" ? "Bloqueado" : "Em aberto"}</dd>
              </div>
              <div>
                <dt>Vencimento</dt>
                <dd>{formatDateTime(task.dueAt)}</dd>
              </div>
              <div>
                <dt>Última adição</dt>
                <dd>{task.snoozedUntil ? formatDateTime(task.snoozedUntil) : "—"}</dd>
              </div>
              <div>
                <dt>Observações</dt>
                <dd>{task.blockedReason ?? "—"}</dd>
              </div>
            </dl>
          </section>

          {task.stepDescription ? (
            <section className={styles.section} aria-label="Descrição do passo">
              <h3>Descrição</h3>
              <p className={styles.description}>{task.stepDescription}</p>
            </section>
          ) : null}

          {tags.length > 0 ? (
            <section className={styles.section} aria-label="Etiquetas">
              <h3>Etiquetas</h3>
              <ul className={styles.tagList}>
                {tags.map((tag) => (
                  <li key={tag} className={styles.tag}>
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.section} aria-label="Ações">
            <div className={styles.actionRow}>
              <div>
                <h3>Concluir tarefa</h3>
                <p className={styles.helper}>Confirme que todas as atividades planejadas foram finalizadas.</p>
              </div>
              <Button
                kind={Button.kinds.PRIMARY}
                size={Button.sizes.SMALL}
                onClick={onComplete}
                disabled={disableActions}
              >
                Concluir agora
              </Button>
            </div>

            <div className={styles.formRow}>
              <label htmlFor="snooze-input" className={styles.label}>
                Adiar até
              </label>
              <input
                id="snooze-input"
                type="datetime-local"
                value={snoozeValue}
                onChange={(event) => setSnoozeValue(event.target.value)}
                className={styles.input}
              />
              <Button
                kind={Button.kinds.SECONDARY}
                size={Button.sizes.SMALL}
                onClick={() => onSnooze(snoozeValue)}
                disabled={disableActions || !snoozeValue}
              >
                Salvar adiamento
              </Button>
            </div>

            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
