import { z } from "zod";
export const tabSchema = z
  .union([z.literal("all"), z.literal("unread"), z.literal("mentions"), z.literal("assigned")])
  .default("all");

export const peopleSchema = z
  .array(z.string().uuid({ message: "Identificador de pessoa inválido" }))
  .optional()
  .transform((value) => value ?? []);

export const cursorSchema = z.string().optional();

export const markStatusBodySchema = z.object({
  orgId: z.string().uuid({ message: "orgId inválido" }),
  ids: z.array(z.string().uuid({ message: "id inválido" })).min(1),
  status: z.union([z.literal("read"), z.literal("unread")]).optional().default("read"),
});

export const markAllBodySchema = z.object({
  orgId: z.string().uuid({ message: "orgId inválido" }),
});

export const muteBodySchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("source"),
    orgId: z.string().uuid({ message: "orgId inválido" }),
    source_type: z.string().min(1),
    source_id: z.string().uuid({ message: "source_id inválido" }),
  }),
  z.object({
    scope: z.literal("type"),
    orgId: z.string().uuid({ message: "orgId inválido" }),
    type: z.string().min(1),
  }),
]);

export const preferencesPatchSchema = z.object({
  orgId: z.string().uuid({ message: "orgId inválido" }),
  email_on_mention_weekly: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
});

export type NotificationTabValue = z.infer<typeof tabSchema>;
