import { getDatabaseClient } from "./client";
import { dialogueStateSchema, type DialogueState } from "@/lib/schemas/dialogue";

type DialogueStateRow = {
  state: unknown;
};

export async function saveDialogueState(
  conversationId: string,
  state: DialogueState,
): Promise<DialogueState> {
  const validated = dialogueStateSchema.parse(state);
  const sql = getDatabaseClient();

  const rows = await sql.query(
    `INSERT INTO dialogue_states (conversation_id, state)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (conversation_id)
     DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
     RETURNING state`,
    [conversationId, JSON.stringify(validated)],
  );

  return dialogueStateSchema.parse((rows[0] as DialogueStateRow).state);
}

export async function getDialogueState(
  conversationId: string,
): Promise<DialogueState | null> {
  const sql = getDatabaseClient();
  const rows = await sql.query(
    `SELECT state FROM dialogue_states WHERE conversation_id = $1`,
    [conversationId],
  );

  return rows.length
    ? dialogueStateSchema.parse((rows[0] as DialogueStateRow).state)
    : null;
}
