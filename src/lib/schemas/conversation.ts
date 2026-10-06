import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common";

export const conversationSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  title: z.string().min(1).nullable().default(null),
  primaryTopic: z.string().min(1).nullable().default(null),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const conversationRoleSchema = z.enum(["user", "assistant", "system"]);

export const conversationTurnSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  role: conversationRoleSchema,
  content: z.string(),
  evidenceIds: z.array(idSchema).default([]),
  createdAt: isoDateTimeSchema,
});

export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
