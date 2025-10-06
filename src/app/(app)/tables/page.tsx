"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button, Text } from "@vibe/core";
import styles from "./tables.module.css";

export default function TablesPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>UI Tokens & Components</h1>
        <div className={styles.actions}>
          <Button kind={Button.kinds.PRIMARY} onClick={() => setOpen(true)}>
            Open Modal
          </Button>
          <Button kind={Button.kinds.SECONDARY}>Secondary</Button>
          <Button kind={Button.kinds.TERTIARY}>Tertiary</Button>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            Monday-style Table
          </Text>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table} role="grid" aria-label="Demo table">
            <thead>
              <tr>
                <th className={styles.thSticky}>Item</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Priority</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.id} className={styles.tr}>
                  <th scope="row" className={styles.thSticky}>
                    <span className={styles.rowTitle}>{row.name}</span>
                  </th>
                  <td>
                    <span className={clsx(styles.pill, styles[`pill_${row.status}`])}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.ownerCell}>
                      <span className={styles.avatar} aria-hidden />
                      <span className={styles.ownerName}>{row.owner}</span>
                    </div>
                  </td>
                  <td>
                    <span className={clsx(styles.chip, styles[`chip_${row.priority}`])}>
                      {row.priority}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{row.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            Form Elements
          </Text>
        </div>

        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <div className={styles.fieldRow}>
            <label htmlFor="name" className={styles.label}>Name</label>
            <input id="name" name="name" className={styles.input} placeholder="Type your name" />
          </div>

          <div className={styles.fieldRow}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input id="email" type="email" name="email" className={styles.input} placeholder="you@company.com" />
          </div>

          <div className={styles.fieldRow}>
            <label htmlFor="role" className={styles.label}>Role</label>
            <select id="role" name="role" className={styles.select} defaultValue="rep">
              <option value="org">Organization</option>
              <option value="leader">Leader</option>
              <option value="rep">Representative</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Notifications</legend>
            <label className={styles.radio}>
              <input type="radio" name="notif" defaultChecked />
              <span>Email</span>
            </label>
            <label className={styles.radio}>
              <input type="radio" name="notif" />
              <span>SMS</span>
            </label>
            <label className={styles.radio}>
              <input type="radio" name="notif" />
              <span>Push</span>
            </label>
          </fieldset>

          <div className={styles.fieldRow}>
            <span className={styles.label}>Tags</span>
            <div className={styles.pillsRow}>
              <span className={clsx(styles.pill, styles.pill_done)}>Done</span>
              <span className={clsx(styles.pill, styles.pill_working)}>Working on it</span>
              <span className={clsx(styles.pill, styles.pill_stuck)}>Stuck</span>
            </div>
          </div>

          <div className={styles.formActions}>
            <Button kind={Button.kinds.SECONDARY}>Cancel</Button>
            <Button kind={Button.kinds.PRIMARY}>Save</Button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
            Chips & Pills
          </Text>
        </div>
        <div className={styles.chipsRow}>
          <span className={clsx(styles.chip, styles.chip_low)}>Low</span>
          <span className={clsx(styles.chip, styles.chip_medium)}>Medium</span>
          <span className={clsx(styles.chip, styles.chip_high)}>High</span>
          <span className={clsx(styles.chip, styles.chip_urgent)}>Urgent</span>
        </div>
      </section>

      {open && (
        <div className={styles.modalRoot} role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
          <div className={styles.modalScrim} onClick={() => setOpen(false)} />
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2 id="demo-modal-title" className={styles.modalTitle}>Quick Create</h2>
            </div>
            <form
              className={styles.modalBody}
              onSubmit={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
            >
              <div className={styles.fieldRow}>
                <label htmlFor="itemName" className={styles.label}>Item name</label>
                <input id="itemName" className={styles.input} placeholder="New item" />
              </div>

              <div className={styles.fieldRow}>
                <label htmlFor="status" className={styles.label}>Status</label>
                <select id="status" className={styles.select} defaultValue="working">
                  <option value="done">Done</option>
                  <option value="working">Working on it</option>
                  <option value="stuck">Stuck</option>
                </select>
              </div>

              <div className={styles.modalActions}>
                <Button kind={Button.kinds.TERTIARY} onClick={() => setOpen(false)}>Close</Button>
                <Button kind={Button.kinds.PRIMARY} type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const ROWS = [
  { id: "r1", name: "Kickoff deck",   status: "working", owner: "Alex", priority: "medium", due: "2025-10-15" },
  { id: "r2", name: "Finalize copy",  status: "done",    owner: "Sam",  priority: "low",    due: "2025-10-11" },
  { id: "r3", name: "Design QA",      status: "stuck",   owner: "Rafa", priority: "high",   due: "2025-10-10" },
  { id: "r4", name: "Handoff",        status: "working", owner: "Kim",  priority: "urgent", due: "2025-10-20" }
];
