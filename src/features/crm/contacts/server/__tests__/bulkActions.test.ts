import { beforeEach, describe, expect, it, vi } from "vitest";
import { performBulkAction } from "../bulkActions";
import { mapContactRow, type ContactRow } from "../listContacts";
import type { MembershipSummary } from "../../types";
import type { SupabaseServerClient } from "../rules";

const mockFetchContactById = vi.fn();

vi.mock("../queries", () => ({
  fetchContactById: (...args: unknown[]) => mockFetchContactById(...args),
}));

class FakeSupabase {
  constructor(private rows: Record<string, ContactRow>) {}

  from(table: string) {
    if (table !== "contacts") {
      throw new Error(`Tabela não suportada: ${table}`);
    }

    return {
      select: () => ({
        eq: (_field: string, organizationId: string) => ({
          in: (_inField: string, ids: string[]) =>
            Promise.resolve({
              data: ids
                .map((id) => this.rows[id])
                .filter((row): row is ContactRow => !!row && row.organization_id === organizationId),
              error: null,
            }),
        }),
      }),
      update: (values: Partial<ContactRow>) => ({
        eq: (_field: string, id: string) => {
          const row = this.rows[id];
          if (!row) {
            return Promise.resolve({ error: { message: "not found" } });
          }
          this.rows[id] = { ...row, ...values } as ContactRow;
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
        eq: (_field: string, id: string) => {
          if (!this.rows[id]) {
            return Promise.resolve({ error: { message: "not found" } });
          }
          delete this.rows[id];
          return Promise.resolve({ error: null });
        },
      }),
    };
  }
}

type MutableRows = Record<string, ContactRow>;

const memberships: MembershipSummary[] = [
  {
    id: "member-org",
    organizationId: "org-1",
    role: "org",
    userId: "user-org",
    displayName: "Org Owner",
    email: "owner@example.com",
    avatarUrl: null,
    parentLeaderId: null,
  },
  {
    id: "member-rep",
    organizationId: "org-1",
    role: "rep",
    userId: "user-rep",
    displayName: "Rep One",
    email: "rep@example.com",
    avatarUrl: null,
    parentLeaderId: "member-org",
  },
];

const actor = memberships[0];

let rows: MutableRows;

beforeEach(() => {
  const now = new Date().toISOString();
  mockFetchContactById.mockReset();
  rows = {
    "contact-1": {
      id: "contact-1",
      organization_id: "org-1",
      owner_membership_id: "member-rep",
      name: "Ana",
      email: "ana@example.com",
      whatsapp: "+5511999999999",
      status: "novo",
      source: "manual",
      tags: ["lead"],
      score: 42,
      last_touch_at: null,
      next_action_at: null,
      next_action_note: null,
      referred_by_contact_id: null,
      lost_reason: null,
      lost_review_at: null,
      archived_at: null,
      created_at: now,
      updated_at: now,
      owner: {
        id: "member-rep",
        organization_id: "org-1",
        role: "rep",
        user_id: "user-rep",
        parent_leader_id: "member-org",
        profile: {
          id: "profile-rep",
          email: "rep@example.com",
          raw_user_meta_data: { name: "Rep One" },
        },
      },
      referred_by: null,
    },
  } as MutableRows;

  mockFetchContactById.mockImplementation(async (_supabase: SupabaseServerClient, id: string) => {
    const row = rows[id];
    return row ? mapContactRow(row) : null;
  });
});

describe("performBulkAction", () => {
  it("arquiva contato acessível", async () => {
    const supabase = new FakeSupabase(rows);
    const result = await performBulkAction({
      supabase: supabase as unknown as SupabaseServerClient,
      organizationId: "org-1",
      actor,
      contactIds: ["contact-1"],
      action: { type: "archive" },
      memberships,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].archivedAt).not.toBeNull();
    expect(rows["contact-1"].archived_at).not.toBeNull();
  });

  it("reativa contato arquivado", async () => {
    rows["contact-1"].archived_at = new Date().toISOString();
    const supabase = new FakeSupabase(rows);

    const result = await performBulkAction({
      supabase: supabase as unknown as SupabaseServerClient,
      organizationId: "org-1",
      actor,
      contactIds: ["contact-1"],
      action: { type: "unarchive" },
      memberships,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.updated[0].archivedAt).toBeNull();
    expect(rows["contact-1"].archived_at).toBeNull();
  });

  it("remove contato ao excluir", async () => {
    const supabase = new FakeSupabase(rows);

    const result = await performBulkAction({
      supabase: supabase as unknown as SupabaseServerClient,
      organizationId: "org-1",
      actor,
      contactIds: ["contact-1"],
      action: { type: "delete" },
      memberships,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.removedIds).toEqual(["contact-1"]);
    expect(rows["contact-1"]).toBeUndefined();
  });
});
