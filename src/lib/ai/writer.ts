import fs from "node:fs";
import path from "node:path";
import { getLlmClient, type LlmClient } from "./client";
import type { PlanDialogueInput } from "./planner";
import { dialoguePlanSchema, type DialoguePlan } from "@/lib/schemas/planner";
import { writtenAnswerSchema, type WrittenAnswer } from "@/lib/schemas/writer";
export type WriteAnswerInput = PlanDialogueInput & { plan: DialoguePlan };
export const writtenAnswerJsonSchema = {
  type: "object", additionalProperties: false,
  required: ["language", "explanationDepth", "paragraphs"],
  properties: {
    language: { type: "string" },
    explanationDepth: { type: "string", enum: ["brief", "balanced", "detailed"] },
    paragraphs: { type: "array", minItems: 1, items: {
      type: "object", additionalProperties: false,
      required: ["text", "claimIds", "evidenceIds", "qualification"],
      properties: {
        text: { type: "string", minLength: 1 },
        claimIds: { type: "array", minItems: 1, items: { type: "string" } },
        evidenceIds: { type: "array", minItems: 1, items: { type: "string" } },
        qualification: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
      },
    } },
  },
};
// Send only accepted planner scope to the writer, never rejected claims.
export function writerContext(input: WriteAnswerInput) {
  const plan = dialoguePlanSchema.parse(input.plan);
  if (["CLARIFY", "REFER"].includes(plan.nextMove)) throw new Error("Writer requires an evidence-backed move.");
  if (["CLARIFY", "REFERRAL"].includes(input.router.route) || input.router.personalRuling) {
    throw new Error("Writer cannot bypass a clarification or referral boundary.");
  }
  if (input.router.route === "DISAGREEMENT" && plan.nextMove !== "EXPLAIN_DISAGREEMENT") throw new Error("Disagreement requires EXPLAIN_DISAGREEMENT.");
  if (plan.activePointId && !input.dialogueState.points.some(p => p.id === plan.activePointId)) throw new Error("Unknown active point.");
  const claims = plan.focusClaimIds.map(id => {
    const matches = input.claims.filter(c => c.id === id);
    const checks = input.verifications.filter(v => v.claimId === id);
    if (matches.length !== 1 || checks.length !== 1) throw new Error("Unknown or ambiguous focused claim.");
    const claim = matches[0], verification = checks[0];
    if (verification.status === "UNSUPPORTED" || claim.status === "UNSUPPORTED") throw new Error("Writer cannot use UNSUPPORTED claims.");
    if (!verification.evidenceIds.length) throw new Error("Verified claim has no evidence.");
    for (const evidenceId of verification.evidenceIds) {
      if (!plan.focusEvidenceIds.includes(evidenceId)) throw new Error("Verified evidence is outside planner focus.");
    }
    return { ...claim, status: verification.status, evidenceIds: verification.evidenceIds, reason: verification.reason };
  });
  if (!claims.length) throw new Error("Writer requires focused verified claims.");
  const evidence = plan.focusEvidenceIds.map(id => {
    const matches = input.evidencePack.evidence.filter(e => e.id === id);
    if (matches.length !== 1) throw new Error("Unknown or ambiguous focused evidence.");
    return matches[0];
  });
  return {
    question: input.evidencePack.question, plan, claims, evidence,
    language: input.userProfile?.preferredResponseLanguage ?? input.router.queryLanguage,
    explanationDepth: input.userProfile?.explanationDepth ?? "balanced",
  };
}
export function validateWrittenAnswer(input: WriteAnswerInput, value: unknown): WrittenAnswer {
  const context = writerContext(input);
  const answer = writtenAnswerSchema.parse(value);
  if (answer.language !== context.language) throw new Error("Writer language mismatch.");
  if (answer.explanationDepth !== context.explanationDepth) throw new Error("Writer explanationDepth mismatch.");
  const limits = { brief: 1200, balanced: 3000, detailed: 8000 };
  if (renderWrittenAnswer(answer).length > limits[answer.explanationDepth]) throw new Error("Writer exceeds explanationDepth limit.");
  for (const paragraph of answer.paragraphs) {
    const linked = paragraph.claimIds.map(id => {
      const claim = context.claims.find(c => c.id === id);
      if (!claim) throw new Error("Writer references unknown or unfocused claim.");
      return claim;
    });
    const allowed = new Set(linked.flatMap(c => c.evidenceIds));
    if (paragraph.evidenceIds.some(id => !allowed.has(id))) throw new Error("Writer cites unrelated or unknown evidence.");
    for (const claim of linked) {
      if (!claim.evidenceIds.some(id => paragraph.evidenceIds.includes(id))) throw new Error("Writer omits claim evidence.");
    }
    if (linked.some(c => c.status !== "SUPPORTED") && !paragraph.qualification) throw new Error("PARTIAL/CONFLICTED claims require a visible qualification.");
  }
  return answer;
}
export function renderWrittenAnswer(answer: WrittenAnswer): string {
  return answer.paragraphs.map(p => [p.text, p.qualification].filter(Boolean).join("\n")).join("\n\n");
}
export async function writeAnswer(input: WriteAnswerInput, llm?: LlmClient): Promise<WrittenAnswer> {
  const context = writerContext(input);
  const raw = await (llm ?? getLlmClient()).generate(JSON.stringify(context), {
    systemInstruction: fs.readFileSync(path.join(process.cwd(), "src/prompts/writer.md"), "utf8"),
    responseMimeType: "application/json", responseJsonSchema: writtenAnswerJsonSchema, temperature: 0,
  });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Writer returned invalid JSON."); }
  return validateWrittenAnswer(input, value);
}
