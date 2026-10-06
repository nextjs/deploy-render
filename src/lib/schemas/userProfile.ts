import { z } from "zod";
import { contentLanguageSchema, uiLanguageSchema } from "./common";

export const religiousBackgroundSchema = z.enum([
  "muslim",
  "non_muslim",
  "other",
  "prefer_not_to_say",
]);

export const userGoalSchema = z.enum([
  "learn_about_islam",
  "ask_specific_question",
  "discuss_misconception",
  "deepen_understanding",
  "structured_debate",
  "other",
]);

export const explanationDepthSchema = z.enum(["brief", "balanced", "detailed"]);

export const userProfileSchema = z.object({
  uiLanguage: uiLanguageSchema,
  preferredResponseLanguage: contentLanguageSchema,
  religiousBackground: religiousBackgroundSchema.optional(),
  goal: userGoalSchema,
  explanationDepth: explanationDepthSchema,
  interests: z.array(z.string().min(1)).default([]),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
