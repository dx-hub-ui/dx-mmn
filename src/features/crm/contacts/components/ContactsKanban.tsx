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
  closestCorners,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button, IconButton, Menu, MenuButton, MenuItem } from "@vibe/core";
import { Add, Column, MoreActions } from "@vibe/icons";
import clsx from "clsx";
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
  onAddContact?: (stage: ContactStageId) => void;
  onConfigureColumn?: (stage: ContactStageId) => void;
  creatingStageId?: ContactStageId | null;
};

type KanbanColumnProps = {
  stage: ContactStageDefinition;
  contacts: ContactRecord[];
  onOpenContact: (contactId: string) => void;
  onAddContact?: (stage: ContactStageId) => void;
  onConfigureColumn?: (stage: ContactStageId) => void;
  isCreating?: boolean;
};

type KanbanCardProps = {
  contact: ContactRecord;
  onOpenContact: (contactId: string) => void;
};

function StageColumn({
  stage,
  contacts,
  onOpenContact,
  onAddContact,
  onConfigureColumn,
  isCreating,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { stageId: stage.id } });

  const handleAddContact = () => {
    if (!isCreating) {
      onAddContact?.(stage.id);
    }
  };

  const handleConfigureColumn = () => {
    onConfigureColumn?.(stage.id);
  };

  return (
    <section
      ref={setNodeRef}
      className={styles.column}
      aria-label={`Coluna ${stage.label}`}
      data-over={isOver || undefined}
      data-tone={stage.tone}
      data-creating={isCreating || undefined}
    >
      <header className={styles.columnHeader}>
        <div className={styles.columnHeaderInfo}>
          <span className={styles.columnTitle}>{stage.label}</span>
          <span className={styles.columnCount}>{contacts.length}</span>
        </div>
        <div className={styles.columnActions}>
          <MenuButton
            ariaLabel={`Abrir opções da coluna ${stage.label}`}
            dialogPosition={MenuButton.dialogPositions.BOTTOM_END}
            dialogClassName={styles.columnMenu}
            closeMenuOnItemClick
            tooltipContent={`Opções de ${stage.label}`}
            component={() => (
              <IconButton
                icon={MoreActions}
                className={styles.columnActionButton}
                kind={IconButton.kinds.TERTIARY}
                size={IconButton.sizes.SMALL}
                tabIndex={-1}
                aria-hidden="true"
              />
            )}
          >
            <Menu>
              <MenuItem
                icon={Add}
                title="Adicionar novo contato"
                onClick={handleAddContact}
                disabled={!onAddContact}
              />
              <MenuItem
                icon={Column}
                title="Definir limite da coluna"
                onClick={handleConfigureColumn}
                disabled={!onConfigureColumn}
              />
            </Menu>
          </MenuButton>
          <IconButton
            icon={Add}
            ariaLabel={`Adicionar contato em ${stage.label}`}
            className={styles.columnActionButton}
            kind={IconButton.kinds.PRIMARY}
            size={IconButton.sizes.SMALL}
            tooltipContent={`Adicionar contato em ${stage.label}`}
            onClick={handleAddContact}
            disabled={!onAddContact || isCreating}
          />
        </div>
      </header>
      <div className={styles.columnBody} role="list">
        {isCreating ? (
          <div className={styles.columnCreating} role="status" aria-live="polite">
            Criando contato…
          </div>
        ) : null}
        {contacts.length === 0 ? (
          <button
            type="button"
            className={styles.columnEmpty}
            onClick={handleAddContact}
            disabled={!onAddContact || isCreating}
          >
            {onAddContact ? "Adicionar contato" : "Arraste contatos para este estágio"}
          </button>
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
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 120 : undefined,
  };

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
      className={clsx(styles.card, isDragging && styles.dragging)}
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

export default function ContactsKanban({
  contacts,
  onStageChange,
  onOpenContact,
  onAddContact,
  onConfigureColumn,
  creatingStageId,
}: ContactsKanbanProps) {
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
    const targetStage = (over.data?.current?.stageId ?? over.id) as ContactStageId;
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact || contact.stage === targetStage) {
      return;
    }
    onStageChange(contactId, targetStage);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
      <div className={styles.board}>
        {CONTACT_STAGES.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            contacts={grouped.get(stage.id) ?? []}
            onOpenContact={onOpenContact}
            onAddContact={onAddContact}
            onConfigureColumn={onConfigureColumn}
            isCreating={creatingStageId === stage.id}
          />
        ))}
      </div>
    </DndContext>
  );
}
