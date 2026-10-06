import { z } from "zod";
import { idSchema } from "./common";
import { sourceTypeSchema } from "./corpus";

export const evidenceRelationSchema = z.enum([
  "SUPPORTS",
  "QUALIFIES",
  "CONTRADICTS",
  "DEFINES",
  "CONTEXTUALIZES",
]);

export const evidenceItemSchema = z.object({
  id: idSchema,
  chunkId: idSchema,
  recordId: idSchema,
  sourceId: idSchema,
  sourceType: sourceTypeSchema,
  sourceName: z.string().min(1),
  text: z.string().min(1),
  locator: z.string().min(1),
  url: z.string().url().optional(),
  relation: evidenceRelationSchema.optional(),
  viewId: idSchema.nullable().default(null),
});

export const evidencePackSchema = z.object({
  question: z.string().min(1),
  evidence: z.array(evidenceItemSchema),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type EvidencePack = z.infer<typeof evidencePackSchema>;
