import { ContactInput, ContactRecord, ContactStageId } from "../types";

export type EditableContactForm = {
  name: string;
  email: string;
  whatsapp: string;
  stage: ContactStageId;
  ownerMembershipId: string;
  tags: string;
  score: string;
  nextActionAt: string;
  nextActionNote: string;
  referredByContactId: string;
  lostReason: string;
  lostReviewAt: string;
};

export function contactToEditable(contact: ContactRecord): EditableContactForm {
  return {
    name: contact.name,
    email: contact.email ?? "",
    whatsapp: contact.whatsapp ?? "",
    stage: contact.stage,
    ownerMembershipId: contact.ownerMembershipId,
    tags: contact.tags.join(", "),
    score: contact.score != null ? String(contact.score) : "",
    nextActionAt: contact.nextActionAt ? contact.nextActionAt.substring(0, 10) : "",
    nextActionNote: contact.nextActionNote ?? "",
    referredByContactId: contact.referredByContactId ?? "",
    lostReason: contact.lostReason ?? "",
    lostReviewAt: contact.lostReviewAt ? contact.lostReviewAt.substring(0, 10) : "",
  };
}

export function emptyEditableForm(currentMembershipId: string): EditableContactForm {
  return {
    name: "",
    email: "",
    whatsapp: "",
    stage: "novo",
    ownerMembershipId: currentMembershipId,
    tags: "",
    score: "",
    nextActionAt: "",
    nextActionNote: "",
    referredByContactId: "",
    lostReason: "",
    lostReviewAt: "",
  };
}

export function parseEditableContactForm(form: EditableContactForm): ContactInput {
  const tags = form.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    name: form.name,
    email: form.email || null,
    whatsapp: form.whatsapp || null,
    stage: form.stage,
    ownerMembershipId: form.ownerMembershipId,
    tags,
    score: form.score ? Number(form.score) : null,
    nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
    nextActionNote: form.nextActionNote || null,
    referredByContactId: form.referredByContactId || null,
    lostReason: form.lostReason || null,
    lostReviewAt: form.lostReviewAt ? new Date(form.lostReviewAt).toISOString() : null,
  };
}

export function contactRecordToInput(contact: ContactRecord): ContactInput {
  return {
    name: contact.name,
    email: contact.email,
    whatsapp: contact.whatsapp,
    stage: contact.stage,
    ownerMembershipId: contact.ownerMembershipId,
    source: contact.source,
    tags: contact.tags,
    score: contact.score,
    nextActionAt: contact.nextActionAt,
    nextActionNote: contact.nextActionNote,
    referredByContactId: contact.referredByContactId,
    lostReason: contact.lostReason,
    lostReviewAt: contact.lostReviewAt,
  };
}
