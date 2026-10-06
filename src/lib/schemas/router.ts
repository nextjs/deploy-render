import { z } from "zod";
import { contentLanguageSchema } from "./common";
import { dialogueStateSchema } from "./dialogue";
import { userProfileSchema } from "./userProfile";

export const contentLevelSchema = z.enum(["A", "B", "C", "D"]);

export const routeSchema = z.enum([
  "LOOKUP",
  "EXPLAIN",
  "DISAGREEMENT",
  "REFERRAL",
  "CLARIFY",
]);

export const routerInputSchema = z.object({
  question: z.string().min(1),
  userProfile: userProfileSchema.optional(),
  dialogueState: dialogueStateSchema.optional(),
});

export const routerOutputSchema = z.object({
  queryLanguage: contentLanguageSchema,
  contentLevel: contentLevelSchema,
  route: routeSchema,
  ambiguous: z.boolean(),
  personalRuling: z.boolean(),
  needs: z.array(z.string().min(1)).default([]),
  conceptIds: z.array(z.string().min(1)).default([]),
  clarificationQuestion: z.string().min(1).nullable().default(null),
});

export type RouterInput = z.infer<typeof routerInputSchema>;
export type RouterOutput = z.infer<typeof routerOutputSchema>;
