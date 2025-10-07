'use client';

import React, { useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  KeyboardSensor,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button } from "@vibe/core";
import {
  CONTACT_STAGES,
  ContactRecord,
  ContactStageDefinition,
  ContactStageId,
} from "../types";
import styles from "./contacts-kanban.module.css";

type ContactsKanbanProps = {
  contacts: ContactRecord[];
  onStageChange: (contactId: string, stage: ContactStageId) => void;
  onOpenContact: (contactId: string) => void;
};

type KanbanColumnProps = {
  stage: ContactStageDefinition;
  contacts: ContactRecord[];
  onOpenContact: (contactId: string) => void;
};

type KanbanCardProps = {
  contact: ContactRecord;
  onOpenContact: (contactId: string) => void;
};

function StageColumn({ stage, contacts, onOpenContact }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      className={styles.column}
      aria-label={`Coluna ${stage.label}`}
      data-over={isOver || undefined}
    >
      <header className={styles.columnHeader}>
        <span>{stage.label}</span>
        <span>{contacts.length}</span>
      </header>
      <div className={styles.columnBody} role="list">
        {contacts.length === 0 ? (
          <div className={styles.columnEmpty}>Arraste contatos para este estágio</div>
        ) : (
          contacts.map((contact) => (
            <KanbanCard key={contact.id} contact={contact} onOpenContact={onOpenContact} />
          ))
        )}
      </div>
    </section>
  );
}

function KanbanCard({ contact, onOpenContact }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: contact.id });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const { role, tabIndex, ...attributeRest } = attributes;
  const draggableProps = {
    role: role ?? "listitem",
    tabIndex: tabIndex ?? 0,
    ...attributeRest,
    ...listeners,
  };

  return (
    <article
      ref={setNodeRef}
      className={`${styles.card}${isDragging ? ` ${styles.dragging}` : ""}`}
      style={style}
      {...draggableProps}
    >
      <div className={styles.cardHeader}>
        <button type="button" className={styles.cardNameButton} onClick={() => onOpenContact(contact.id)}>
          {contact.name}
        </button>
        <span className={styles.stageBadge}>{contact.stage.toUpperCase()}</span>
      </div>
      <div className={styles.cardMeta}>
        <span>Dono: {contact.owner?.displayName ?? "Sem dono"}</span>
        {contact.nextActionNote ? <span>Próximo: {contact.nextActionNote}</span> : null}
        {contact.nextActionAt ? <span>Data: {new Date(contact.nextActionAt).toLocaleDateString("pt-BR")}</span> : null}
      </div>
      <div className={styles.cardActions}>
        <Button
          kind={Button.kinds.SECONDARY}
          disabled={!contact.whatsapp}
          onClick={() => contact.whatsapp && window.open(`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`)}
        >
          WhatsApp
        </Button>
        <Button
          kind={Button.kinds.SECONDARY}
          disabled={!contact.email}
          onClick={() => contact.email && window.open(`mailto:${contact.email}`)}
        >
          E-mail
        </Button>
      </div>
    </article>
  );
}

export default function ContactsKanban({ contacts, onStageChange, onOpenContact }: ContactsKanbanProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const grouped = useMemo(() => {
    const byStage = new Map<ContactStageId, ContactRecord[]>();
    for (const stage of CONTACT_STAGES) {
      byStage.set(stage.id, []);
    }
    for (const contact of contacts) {
      if (!byStage.has(contact.stage)) {
        byStage.set(contact.stage, []);
      }
      byStage.get(contact.stage)!.push(contact);
    }
    return byStage;
  }, [contacts]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) {
      return;
    }
    const contactId = String(active.id);
    const targetStage = over.id as ContactStageId;
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact || contact.stage === targetStage) {
      return;
    }
    onStageChange(contactId, targetStage);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={styles.board}>
        {CONTACT_STAGES.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            contacts={grouped.get(stage.id) ?? []}
            onOpenContact={onOpenContact}
          />
        ))}
      </div>
    </DndContext>
  );
}
