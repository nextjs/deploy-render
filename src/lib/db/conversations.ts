import { randomUUID } from "node:crypto";
import { getDatabaseClient } from "./client";
import { conversationSchema, type Conversation } from "@/lib/schemas/conversation";

type ConversationRow = {
  id: string;
  session_id: string;
  title: string | null;
  primary_topic: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapConversation(row: ConversationRow): Conversation {
  return conversationSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    primaryTopic: row.primary_topic,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

export async function createConversation(input: {
  sessionId: string;
  title?: string | null;
  primaryTopic?: string | null;
}): Promise<Conversation> {
  const sql = getDatabaseClient();
  const id = randomUUID();

  const rows = await sql.query(
    `INSERT INTO conversations (id, session_id, title, primary_topic)
     VALUES ($1, $2, $3, $4)
     RETURNING id, session_id, title, primary_topic, created_at, updated_at`,
    [id, input.sessionId, input.title ?? null, input.primaryTopic ?? null],
  );

  return mapConversation(rows[0] as ConversationRow);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const sql = getDatabaseClient();
  const rows = await sql.query(
    `SELECT id, session_id, title, primary_topic, created_at, updated_at
     FROM conversations WHERE id = $1`,
    [id],
  );

  return rows.length ? mapConversation(rows[0] as ConversationRow) : null;
}
