import { randomUUID } from "node:crypto";
import { getDatabaseClient } from "./client";
import { sessionSchema, type Session } from "@/lib/schemas/session";
import { userProfileSchema, type UserProfile } from "@/lib/schemas/userProfile";

type SessionRow = {
  id: string;
  user_profile: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapSession(row: SessionRow): Session {
  return sessionSchema.parse({
    id: row.id,
    userProfile: row.user_profile,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

export async function createSession(userProfile: UserProfile): Promise<Session> {
  const profile = userProfileSchema.parse(userProfile);
  const sql = getDatabaseClient();
  const id = randomUUID();

  const rows = await sql.query(
    `INSERT INTO sessions (id, user_profile)
     VALUES ($1, $2::jsonb)
     RETURNING id, user_profile, created_at, updated_at`,
    [id, JSON.stringify(profile)],
  );

  return mapSession(rows[0] as SessionRow);
}

export async function getSession(id: string): Promise<Session | null> {
  const sql = getDatabaseClient();
  const rows = await sql.query(
    `SELECT id, user_profile, created_at, updated_at
     FROM sessions
     WHERE id = $1`,
    [id],
  );

  return rows.length ? mapSession(rows[0] as SessionRow) : null;
}

export async function updateSessionProfile(
  id: string,
  userProfile: UserProfile,
): Promise<Session | null> {
  const profile = userProfileSchema.parse(userProfile);
  const sql = getDatabaseClient();
  const rows = await sql.query(
    `UPDATE sessions
     SET user_profile = $2::jsonb, updated_at = NOW()
     WHERE id = $1
     RETURNING id, user_profile, created_at, updated_at`,
    [id, JSON.stringify(profile)],
  );

  return rows.length ? mapSession(rows[0] as SessionRow) : null;
}
