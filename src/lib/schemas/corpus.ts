import { z } from "zod";
import { contentLanguageSchema, idSchema } from "./common";

export const sourceTypeSchema = z.enum([
  "quran",
  "tafsir",
  "hadith",
  "aqeedah",
  "fiqh",
  "seerah",
  "history",
  "misconception",
  "terminology",
  "other_approved",
]);

export const baseSourceRecordSchema = z.object({
  recordId: idSchema,
  sourceId: idSchema,
  sourceType: sourceTypeSchema,
  title: z.string().nullable().default(null),
  text: z.string().min(1),
  language: contentLanguageSchema,
  locator: z.string().min(1),
  url: z.string().url().optional(),
  conceptIds: z.array(idSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const chunkRecordSchema = z.object({
  chunkId: idSchema,
  recordId: idSchema,
  sourceId: idSchema,
  sourceType: sourceTypeSchema,
  text: z.string().min(1),
  language: contentLanguageSchema,
  locator: z.string().min(1),
  url: z.string().url().optional(),
  conceptIds: z.array(idSchema).default([]),
  chunkIndex: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type BaseSourceRecord = z.infer<typeof baseSourceRecordSchema>;
export type ChunkRecord = z.infer<typeof chunkRecordSchema>;
