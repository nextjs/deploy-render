import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getLlmClient, type LlmClient } from "./client";
import { validateWrittenAnswer, writerContext, type WriteAnswerInput } from "./writer";
import type { WrittenAnswer } from "@/lib/schemas/writer";
const resultSchema = z.object({
  passed: z.boolean(),
  paragraphs: z.array(z.object({
    index: z.number().int().nonnegative(),
    supported: z.boolean(),
    qualificationsPreserved: z.boolean(),
    languageCorrect: z.boolean(),
    moveFollowed: z.boolean(),
    reason: z.string().trim().min(1),
  }).strict()),
}).strict();
export type FinalVerification = z.infer<typeof resultSchema>;
export async function verifyFinalAnswer(input: WriteAnswerInput, answer: WrittenAnswer, llm?: LlmClient): Promise<FinalVerification> {
  const checked = validateWrittenAnswer(input, answer);
  const context = writerContext(input);
  const raw = await (llm ?? getLlmClient()).generate(JSON.stringify({ context, answer: checked }), {
    systemInstruction: fs.readFileSync(path.join(process.cwd(), "src/prompts/verifier.md"), "utf8"),
    responseMimeType: "application/json", temperature: 0,
    responseJsonSchema: {
      type: "object", additionalProperties: false, required: ["passed", "paragraphs"],
      properties: {
        passed: { type: "boolean" },
        paragraphs: { type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["index", "supported", "qualificationsPreserved", "languageCorrect", "moveFollowed", "reason"],
          properties: {
            index: { type: "integer", minimum: 0 }, supported: { type: "boolean" },
            qualificationsPreserved: { type: "boolean" }, languageCorrect: { type: "boolean" },
            moveFollowed: { type: "boolean" }, reason: { type: "string", minLength: 1 },
          },
        } },
      },
    },
  });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { throw new Error("Final verifier returned invalid JSON."); }
  const result = resultSchema.parse(json);
  const indexes = new Set(result.paragraphs.map(p => p.index));
  if (result.paragraphs.length !== checked.paragraphs.length || indexes.size !== checked.paragraphs.length ||
      result.paragraphs.some(p => p.index >= checked.paragraphs.length)) throw new Error("Final verifier must check every paragraph exactly once.");
  const passed = result.paragraphs.every(p => p.supported && p.qualificationsPreserved && p.languageCorrect && p.moveFollowed);
  if (result.passed !== passed) throw new Error("Final verifier returned an inconsistent verdict.");
  return result;
}
