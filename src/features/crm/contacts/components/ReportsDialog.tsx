"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@vibe/core";
import { CONTACT_STAGES, ContactRecord } from "../types";
import styles from "./reports-dialog.module.css";

type ReportsDialogProps = {
  open: boolean;
  onClose: () => void;
  contacts: ContactRecord[];
};

export default function ReportsDialog({ open, onClose, contacts }: ReportsDialogProps) {
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

  const totalContacts = contacts.length;

  const funnel = useMemo(() => {
    return CONTACT_STAGES.map((stage) => {
      const count = contacts.filter((contact) => contact.stage === stage.id).length;
      const percentage = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
      return { stage, count, percentage };
    });
  }, [contacts, totalContacts]);

  const topReferrers = useMemo(() => {
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const map = new Map<string, { name: string; count: number }>();
    contacts.forEach((contact) => {
      if (!contact.referredBy || !contact.createdAt) {
        return;
      }
      const createdAt = new Date(contact.createdAt).getTime();
      if (Number.isNaN(createdAt) || createdAt < threshold) {
        return;
      }
      const entry = map.get(contact.referredBy.id) ?? {
        name: contact.referredBy.name,
        count: 0,
      };
      entry.count += 1;
      map.set(contact.referredBy.id, entry);
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [contacts]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="reports-title">Relatórios de contatos</h2>
          <Button kind={Button.kinds.TERTIARY} onClick={onClose}>
            Fechar
          </Button>
        </div>

        <section className={styles.section} aria-labelledby="funnel-title">
          <h3 id="funnel-title">Funil por estágio</h3>
          {totalContacts === 0 ? (
            <p className={styles.empty}>Nenhum contato disponível.</p>
          ) : (
            <table className={styles.table} aria-describedby="funnel-title">
              <thead>
                <tr>
                  <th>Estágio</th>
                  <th>Quantidade</th>
                  <th>Percentual</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map(({ stage, count, percentage }) => (
                  <tr key={stage.id}>
                    <td>{stage.label}</td>
                    <td>{count}</td>
                    <td>{percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.section} aria-labelledby="referrers-title">
          <h3 id="referrers-title">Top indicantes (últimos 30 dias)</h3>
          {topReferrers.length === 0 ? (
            <p className={styles.empty}>Nenhuma indicação registrada nos últimos 30 dias.</p>
          ) : (
            <table className={styles.table} aria-describedby="referrers-title">
              <thead>
                <tr>
                  <th>Contato</th>
                  <th>Indicações</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map((referrer) => (
                  <tr key={referrer.name}>
                    <td>{referrer.name}</td>
                    <td>{referrer.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
