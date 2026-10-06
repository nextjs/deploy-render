import { z } from "zod";
import { idSchema } from "./common";
import { atomicClaimSchema } from "./claims";
import { dialogueStateSchema } from "./dialogue";
import { evidenceItemSchema } from "./evidence";
import { discussionMapSchema } from "./graph";
import { disagreementStateSchema } from "./disagreement";
import { referralStateSchema } from "./referral";
import { contentLevelSchema, routeSchema } from "./router";

export const responseStatusSchema = z.enum([
  "ok",
  "clarification_required",
  "referral",
  "insufficient_evidence",
  "error",
]);

export const structuredResponseSchema = z.object({
  responseId: idSchema,
  conversationId: idSchema,
  status: responseStatusSchema,
  message: z.string(),
  contentLevel: contentLevelSchema,
  route: routeSchema,
  citations: z.array(evidenceItemSchema).default([]),
  claims: z.array(atomicClaimSchema).default([]),
  dialogueState: dialogueStateSchema,
  discussionMap: discussionMapSchema,
  disagreement: disagreementStateSchema.nullable().default(null),
  referral: referralStateSchema.nullable().default(null),
  suggestedActions: z.array(z.string().min(1)).default([]),
});

export type StructuredResponse = z.infer<typeof structuredResponseSchema>;
