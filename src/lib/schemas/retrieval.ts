import { z } from "zod";
import { contentLanguageSchema, idSchema } from "./common";
import { contentLevelSchema, routeSchema } from "./router";
import { sourceTypeSchema } from "./corpus";

export const retrievalQuerySchema = z.object({
  query: z.string().min(1),
  route: routeSchema,
  contentLevel: contentLevelSchema,
  queryLanguage: contentLanguageSchema,
  preferredResponseLanguage: contentLanguageSchema,
  preferredSourceLanguages: z.array(contentLanguageSchema).default([]),
  conceptIds: z.array(idSchema).default([]),
  sourceTypes: z.array(sourceTypeSchema).default([]),
  topK: z.number().int().positive().max(50).default(8),
});

export const evidenceCandidateSchema = z.object({
  id: idSchema,
  chunkId: idSchema,
  recordId: idSchema,
  sourceId: idSchema,
  sourceType: sourceTypeSchema,
  sourceName: z.string().min(1),
  text: z.string().min(1),
  language: contentLanguageSchema,
  locator: z.string().min(1),
  url: z.string().url().optional(),
  score: z.number(),
  retrievalMethod: z.enum(["semantic", "keyword", "hybrid", "exact"]),
  conceptIds: z.array(idSchema).default([]),
});

export type RetrievalQuery = z.infer<typeof retrievalQuerySchema>;
export type EvidenceCandidate = z.infer<typeof evidenceCandidateSchema>;
