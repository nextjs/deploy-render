import { z } from "zod";
import { idSchema } from "./common";
import { dialogueStateSchema } from "./dialogue";
import { userProfileSchema } from "./userProfile";

export const chatRequestSchema = z.object({
  sessionId: idSchema,
  conversationId: idSchema,
  message: z.string().min(1),
  userProfile: userProfileSchema.optional(),
  dialogueState: dialogueStateSchema.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
