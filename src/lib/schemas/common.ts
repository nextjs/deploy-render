import { z } from "zod";

export const idSchema = z.string().min(1);
export const isoDateTimeSchema = z.string().datetime({ offset: true }).or(z.string().datetime());

// UI is currently designed in Arabic and English.
export const uiLanguageSchema = z.enum(["ar", "en"]);

// User questions and approved corpus records may use any BCP-47-style language tag.
// Examples: ar, en, fr, ur, id, zh, es, en-US.
export const contentLanguageSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/);

// Backward-compatible alias for existing imports.
// New code should prefer uiLanguageSchema or contentLanguageSchema explicitly.
export const languageSchema = uiLanguageSchema;

export type UiLanguage = z.infer<typeof uiLanguageSchema>;
export type ContentLanguage = z.infer<typeof contentLanguageSchema>;
export type Language = z.infer<typeof languageSchema>;
