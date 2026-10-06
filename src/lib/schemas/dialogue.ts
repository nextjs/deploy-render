import { z } from "zod";
import { idSchema } from "./common";

export const dialoguePointStatusSchema = z.enum(["active", "resolved", "open", "disputed"]);

export const dialoguePointKindSchema = z.enum([
  "question",
  "concept",
  "claim",
  "misconception",
  "viewpoint",
  "summary",
]);

export const dialoguePointSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  kind: dialoguePointKindSchema,
  status: dialoguePointStatusSchema,
  parentId: idSchema.nullable().default(null),
});

export const dialogueStateSchema = z.object({
  mainTopic: z.string().nullable().default(null),
  points: z.array(dialoguePointSchema).default([]),
  activePointId: idSchema.nullable().default(null),
  resolvedPointIds: z.array(idSchema).default([]),
  openPointIds: z.array(idSchema).default([]),
  disputedPointIds: z.array(idSchema).default([]),
  evidenceUsed: z.array(idSchema).default([]),
});

export type DialoguePoint = z.infer<typeof dialoguePointSchema>;
export type DialogueState = z.infer<typeof dialogueStateSchema>;
