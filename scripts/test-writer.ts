import assert from "node:assert/strict";
import { writeAnswer, renderWrittenAnswer, type WriteAnswerInput } from "../src/lib/ai/writer";
import type { WrittenAnswer } from "../src/lib/schemas/writer";
import type { LlmClient } from "../src/lib/ai/client";
export const input: WriteAnswerInput = {
  router: { queryLanguage: "ar", contentLevel: "B", route: "EXPLAIN", ambiguous: false, personalRuling: false, needs: ["evidence"], conceptIds: [], clarificationQuestion: null },
  evidencePack: { question: "سؤال تجريبي", evidence: [{ id: "e1", chunkId: "k1", recordId: "r1", sourceId: "s1", sourceType: "other_approved", sourceName: "Test", text: "Controlled fact", locator: "test:1", viewId: null }] },
  claims: [{ id: "c1", text: "Controlled fact", evidenceIds: ["e1"], status: "SUPPORTED" }],
  verifications: [{ claimId: "c1", status: "SUPPORTED", reason: "Supported", evidenceIds: ["e1"] }],
  dialogueState: { mainTopic: null, points: [], activePointId: null, resolvedPointIds: [], openPointIds: [], disputedPointIds: [], evidenceUsed: [] },
  plan: { nextMove: "ANSWER", activePointId: null, reason: "Answer", focusClaimIds: ["c1"], focusEvidenceIds: ["e1"], clarificationQuestion: null },
};
export const answer: WrittenAnswer = { language: "ar", explanationDepth: "balanced", paragraphs: [{ text: "حقيقة تجريبية", claimIds: ["c1"], evidenceIds: ["e1"], qualification: null }] };
export const fake = (value: unknown): LlmClient => ({ generate: async () => JSON.stringify(value) });
async function main() {
  assert.equal(renderWrittenAnswer(await writeAnswer(input, fake(answer))), "حقيقة تجريبية");
  await assert.rejects(() => writeAnswer(input, fake({ ...answer, language: "en" })), /language mismatch/);
  await assert.rejects(() => writeAnswer(input, fake({ ...answer, explanationDepth: "brief" })), /explanationDepth mismatch/);
  for (const changed of [{ claimIds: ["fake"] }, { evidenceIds: ["fake"] }, { evidenceIds: [] }]) {
    await assert.rejects(() => writeAnswer(input, fake({ ...answer, paragraphs: [{ ...answer.paragraphs[0], ...changed }] })));
  }
  await assert.rejects(() => writeAnswer({ ...input, verifications: [{ ...input.verifications[0], status: "UNSUPPORTED" }] }, fake(answer)), /UNSUPPORTED/);
  for (const status of ["PARTIAL", "CONFLICTED"] as const) {
    const qualified = { ...input, verifications: [{ ...input.verifications[0], status }] };
    await assert.rejects(() => writeAnswer(qualified, fake(answer)), /qualification/);
    const result = await writeAnswer(qualified, fake({ ...answer, paragraphs: [{ ...answer.paragraphs[0], qualification: "توجد حدود لهذا الدليل" }] }));
    assert.match(renderWrittenAnswer(result), /توجد حدود/);
  }
  await assert.rejects(() => writeAnswer(input, { generate: async () => "bad json" }), /invalid JSON/);
  await assert.rejects(() => writeAnswer(input, fake({ ...answer, paragraphs: [{ ...answer.paragraphs[0], text: "x".repeat(3001) }] })), /limit/);
  await assert.rejects(() => writeAnswer({ ...input, router: { ...input.router, personalRuling: true } }, fake(answer)), /boundary/);
  let prompt = "";
  await writeAnswer({ ...input, claims: [...input.claims, { id: "rejected", text: "SECRET_UNSUPPORTED", evidenceIds: ["e1"], status: "UNSUPPORTED" }] }, { generate: async p => { prompt = p; return JSON.stringify(answer); } });
  assert.ok(!prompt.includes("SECRET_UNSUPPORTED"));
  console.log("Writer tests passed: scope, citations, language, depth, qualifications, malformed output, referral boundary.");
}
if (process.argv[1]?.endsWith("test-writer.ts")) main().catch(e => { console.error(e); process.exitCode = 1; });
