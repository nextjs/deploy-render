import { z } from "zod";
import { idSchema } from "./common";

export const scholarlyViewSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  summary: z.string().min(1),
  evidenceIds: z.array(idSchema).default([]),
});

export const disagreementStateSchema = z.object({
  agreementPoints: z.array(z.string().min(1)).default([]),
  disputedPoint: z.string().min(1),
  views: z.array(scholarlyViewSchema).min(2),
  confidentConclusion: z.string().nullable().default(null),
  unresolvedNote: z.string().nullable().default(null),
});

export type ScholarlyView = z.infer<typeof scholarlyViewSchema>;
export type DisagreementState = z.infer<typeof disagreementStateSchema>;
