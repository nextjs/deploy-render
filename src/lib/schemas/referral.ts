import { z } from "zod";

export const referralReasonSchema = z.enum([
  "personal_fatwa",
  "insufficient_evidence",
  "legal_medical_family_complexity",
  "out_of_scope",
  "other",
]);

export const referralStateSchema = z.object({
  reason: referralReasonSchema,
  message: z.string().min(1),
  safeGeneralInformation: z.string().nullable().default(null),
  specialistType: z.string().nullable().default(null),
});

export type ReferralState = z.infer<typeof referralStateSchema>;
