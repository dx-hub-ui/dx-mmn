import { z } from "zod";

const contextSchema = z.object({
  request_id: z.string().optional(),
  user_id: z.string().optional(),
  org_id: z.string().optional(),
});

const contactSchema = contextSchema.extend({
  contact_id: z.string().optional(),
});

const playbookSchema = contextSchema.extend({
  playbook_id: z.string().optional(),
  version_id: z.string().optional(),
});

const sequenceSchema = contextSchema.extend({
  sequence_id: z.string().optional(),
  version_id: z.string().optional(),
});

const micrositeSchema = contextSchema.extend({
  microsite_id: z.string().optional(),
});

const gamificationSchema = contextSchema.extend({
  points: z.number().optional(),
  badge: z.string().optional(),
});

const notificationSchema = contextSchema.extend({
  notification_id: z.string().optional(),
  template: z.string().optional(),
  provider: z.enum(["resend", "brevo"]).optional(),
});

const uiSchema = contextSchema.extend({
  surface: z.string().optional(),
  value: z.string().optional(),
});

const reliabilitySchema = contextSchema.extend({
  module: z.string().optional(),
  action: z.string().optional(),
  status: z.enum(["success", "error"]).optional(),
  message: z.string().optional(),
});

export const eventSchemas = {
  "auth:signup_started": contextSchema.extend({ method: z.string().optional() }),
  "auth:signup_completed": contextSchema.extend({ method: z.string().optional() }),
  "auth:login": contextSchema.extend({ method: z.string().optional() }),
  "auth:logout": contextSchema,
  "contacts:create": contactSchema.extend({ source: z.string().optional() }),
  "contacts:update": contactSchema.extend({ changes: z.record(z.unknown()).optional() }),
  "contacts:status_changed": contactSchema.extend({ status: z.string() }),
  "contacts:bulk_action": contextSchema.extend({ action: z.string(), total: z.number() }),
  "playbooks:create": playbookSchema,
  "playbooks:publish": playbookSchema.extend({ status: z.string().optional() }),
  "playbooks:assign": playbookSchema.extend({ assignee_id: z.string().optional() }),
  "sequences:create": sequenceSchema,
  "sequences:version_publish": sequenceSchema.extend({ status: z.string().optional() }),
  "sequences:enroll_contact": sequenceSchema.extend({ contact_id: z.string().optional() }),
  "sequences:step_completed": sequenceSchema.extend({ step_id: z.string().optional() }),
  "microsites:create": micrositeSchema,
  "microsites:submission_received": micrositeSchema.extend({ submission_id: z.string().optional() }),
  "gamification:points_awarded": gamificationSchema.extend({ reason: z.string().optional() }),
  "gamification:badge_earned": gamificationSchema.extend({ reason: z.string().optional() }),
  "notifications:email_queued": notificationSchema,
  "notifications:email_sent": notificationSchema.extend({ message_id: z.string().optional() }),
  "notifications:email_failed": notificationSchema.extend({ error: z.string().optional() }),
  "ui:theme_changed": uiSchema.extend({ value: z.string() }),
  "ui:menu_opened": uiSchema,
  "ui:modal_opened": uiSchema,
  "errors:client_runtime": reliabilitySchema.extend({ error: z.string().optional() }),
  "errors:server_exception": reliabilitySchema.extend({ error: z.string().optional() }),
  "api_request_failed": reliabilitySchema.extend({
    url: z.string().optional(),
    method: z.string().optional(),
    status_code: z.number().optional(),
  }),
} as const;

export type EventName = keyof typeof eventSchemas;
export type EventPayload<Name extends EventName> = z.infer<(typeof eventSchemas)[Name]>;

export function validateEvent<Name extends EventName>(name: Name, payload: unknown) {
  return eventSchemas[name].safeParse(payload);
}
