import { z } from "zod";
import { idSchema } from "./common";

export const claimStatusSchema = z.enum([
  "SUPPORTED",
  "PARTIAL",
  "CONFLICTED",
  "UNSUPPORTED",
]);

export const atomicClaimSchema = z.object({
  id: idSchema,
  text: z.string().min(1),
  evidenceIds: z.array(idSchema).min(1),
  status: claimStatusSchema.optional(),
});

export const claimVerificationSchema = z.object({
  claimId: idSchema,
  status: claimStatusSchema,
  reason: z.string().min(1),
  evidenceIds: z.array(idSchema),
});

export type AtomicClaim = z.infer<typeof atomicClaimSchema>;
export type ClaimVerification = z.infer<typeof claimVerificationSchema>;
