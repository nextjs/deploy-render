import { randomUUID } from "node:crypto";
import { getDatabaseClient } from "./client";
import {
  conversationRoleSchema,
  conversationTurnSchema,
  type ConversationTurn,
} from "@/lib/schemas/conversation";

type TurnRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  evidence_ids: unknown;
  created_at: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapTurn(row: TurnRow): ConversationTurn {
  return conversationTurnSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    evidenceIds: row.evidence_ids,
    createdAt: toIso(row.created_at),
  });
}

export async function saveConversationTurn(input: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  evidenceIds?: string[];
}): Promise<ConversationTurn> {
  const sql = getDatabaseClient();
  const id = randomUUID();
  const role = conversationRoleSchema.parse(input.role);

  const rows = await sql.query(
    `INSERT INTO conversation_turns
       (id, conversation_id, role, content, evidence_ids)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, conversation_id, role, content, evidence_ids, created_at`,
    [id, input.conversationId, role, input.content, JSON.stringify(input.evidenceIds ?? [])],
  );

  return mapTurn(rows[0] as TurnRow);
}

export async function listConversationTurns(
  conversationId: string,
): Promise<ConversationTurn[]> {
  const sql = getDatabaseClient();
  const rows = await sql.query(
    `SELECT id, conversation_id, role, content, evidence_ids, created_at
     FROM conversation_turns
     WHERE conversation_id = $1
     ORDER BY created_at ASC, id ASC`,
    [conversationId],
  );

  return rows.map((row) => mapTurn(row as TurnRow));
}
