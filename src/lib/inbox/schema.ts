import { z } from "zod";

export const inboxTabSchema = z.enum(["all", "mentions", "bookmarked", "account", "scheduled", "new"]);
export const inboxShowSchema = z.enum(["unread", "all"]);
export const inboxBoardSchema = z.union([z.literal("all"), z.literal("without"), z.string().uuid()]);

const limitSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return undefined;
    }
    return Math.min(Math.max(parsed, 1), 100);
  });

export type InboxQueryInput = {
  tab: z.infer<typeof inboxTabSchema>;
  show: z.infer<typeof inboxShowSchema>;
  board: z.infer<typeof inboxBoardSchema>;
  cursor: string | null;
  limit: number;
};

export function parseInboxQuery(searchParams: URLSearchParams): InboxQueryInput {
  const tab = inboxTabSchema.catch("all").parse(searchParams.get("tab") ?? "all");
  const show = inboxShowSchema.catch("unread").parse(searchParams.get("show") ?? "unread");
  const boardRaw = searchParams.get("board") ?? "all";
  const board = inboxBoardSchema.catch("all").parse(boardRaw);
  const cursor = searchParams.get("cursor");
  const limit = limitSchema.parse(searchParams.get("limit")) ?? 20;

  return { tab, show, board, cursor, limit };
}
