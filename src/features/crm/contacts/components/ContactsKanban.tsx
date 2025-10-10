'use client';

import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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

type DraggableListeners = ReturnType<typeof useDraggable>["listeners"];
type DraggableAttributes = ReturnType<typeof useDraggable>["attributes"];

type KanbanCardViewProps = KanbanCardProps & {
  listeners?: DraggableListeners;
  attributes?: DraggableAttributes;
  isDragging?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
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
            <DraggableKanbanCard key={contact.id} contact={contact} onOpenContact={onOpenContact} />
          ))
        )}
      </div>
    </section>
  );
}

const KanbanCardView = React.forwardRef<HTMLArticleElement, KanbanCardViewProps>(function KanbanCardView(
  { contact, onOpenContact, listeners, attributes, isDragging, isOverlay, style }: KanbanCardViewProps,
  ref
) {
  const { role, tabIndex, ...attributeRest } = attributes ?? {};
  const draggableProps = {
    role: role ?? "listitem",
    tabIndex: isOverlay ? -1 : tabIndex ?? 0,
    ...attributeRest,
    ...(listeners ?? {}),
  };

  return (
    <article
      ref={ref}
      className={clsx(styles.card, isDragging && styles.dragging, isOverlay && styles.overlay)}
      style={style}
      aria-hidden={isOverlay ? true : undefined}
      {...draggableProps}
    >
      <header className={styles.cardHeader}>
        <button type="button" className={styles.cardNameButton} onClick={() => onOpenContact(contact.id)}>
          {contact.name}
        </button>
        <span className={styles.stageBadge}>{contact.stage.toUpperCase()}</span>
      </header>
      <ul className={styles.cardMeta} aria-label="Detalhes do contato">
        <li className={styles.metaItem}>Dono: {contact.owner?.displayName ?? "Sem dono"}</li>
        {contact.nextActionNote ? <li className={styles.metaItem}>Próximo: {contact.nextActionNote}</li> : null}
        {contact.nextActionAt ? (
          <li className={styles.metaItem}>
            Data: {new Date(contact.nextActionAt).toLocaleDateString("pt-BR")}
          </li>
        ) : null}
      </ul>
      <div className={styles.cardActions}>
        <Button
          kind={Button.kinds.TERTIARY}
          size={Button.sizes.SMALL}
          disabled={!contact.whatsapp}
          onClick={() => contact.whatsapp && window.open(`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`)}
        >
          WhatsApp
        </Button>
        <Button
          kind={Button.kinds.TERTIARY}
          size={Button.sizes.SMALL}
          disabled={!contact.email}
          onClick={() => contact.email && window.open(`mailto:${contact.email}`)}
        >
          E-mail
        </Button>
      </div>
    </article>
  );
});

function DraggableKanbanCard({ contact, onOpenContact }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: contact.id });

  const style: React.CSSProperties = {};
  if (transform) {
    style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
  }
  if (isDragging) {
    style.zIndex = 160;
  }

  return (
    <KanbanCardView
      ref={setNodeRef}
      contact={contact}
      onOpenContact={onOpenContact}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      style={style}
    />
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
  const [activeId, setActiveId] = useState<string | null>(null);
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

  const handleDragStart = (event: DragStartEvent) => {
    if (!event.active) {
      return;
    }
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) {
      setActiveId(null);
      return;
    }
    const contactId = String(active.id);
    const targetStage = (over.data?.current?.stageId ?? over.id) as ContactStageId;
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact || contact.stage === targetStage) {
      setActiveId(null);
      return;
    }
    onStageChange(contactId, targetStage);
    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeContact = useMemo(
    () => contacts.find((item) => item.id === activeId) ?? null,
    [activeId, contacts]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={closestCorners}
    >
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
      <DragOverlay dropAnimation={null}>
        {activeContact ? (
          <KanbanCardView contact={activeContact} onOpenContact={onOpenContact} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
