import { z } from "zod";
import { contentLanguageSchema, idSchema } from "./common";
import { explanationDepthSchema } from "./userProfile";
export const writtenAnswerSchema = z.object({
  language: contentLanguageSchema,
  explanationDepth: explanationDepthSchema,
  paragraphs: z.array(z.object({
    text: z.string().trim().min(1),
    claimIds: z.array(idSchema).min(1),
    evidenceIds: z.array(idSchema).min(1),
    qualification: z.string().trim().min(1).nullable(),
  }).strict()).min(1),
}).strict();
export type WrittenAnswer = z.infer<typeof writtenAnswerSchema>;
