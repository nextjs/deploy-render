import { z } from "zod";
import { idSchema } from "./common";

export const dialogueMoveSchema = z.enum([
  "ANSWER",
  "CLARIFY",
  "DEFINE",
  "SHOW_EVIDENCE",
  "EXPLAIN_DISAGREEMENT",
  "REFER",
]);

export const dialoguePlanSchema = z.object({
  nextMove: dialogueMoveSchema,
  activePointId: idSchema.nullable().default(null),
  reason: z.string().min(1),
  focusClaimIds: z.array(idSchema).default([]),
  focusEvidenceIds: z.array(idSchema).default([]),
  clarificationQuestion: z.string().min(1).nullable().default(null),
});

export type DialogueMove = z.infer<typeof dialogueMoveSchema>;
export type DialoguePlan = z.infer<typeof dialoguePlanSchema>;
