import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common";
import { userProfileSchema } from "./userProfile";

export const sessionSchema = z.object({
  id: idSchema,
  userProfile: userProfileSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Session = z.infer<typeof sessionSchema>;
