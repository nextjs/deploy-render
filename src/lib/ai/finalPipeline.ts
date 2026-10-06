import { planDialogue, type PlanDialogueInput } from "./planner";
import { writeAnswer, renderWrittenAnswer } from "./writer";
import { verifyFinalAnswer } from "./verifier";
import type { LlmClient } from "./client";
export async function generateFinalResponse(input: PlanDialogueInput, llm?: LlmClient) {
  const plan = llm ? await planDialogue(input, llm) : await planDialogue(input);
  const writerInput = { ...input, plan };
  const answer = await writeAnswer(writerInput, llm);
  const verification = await verifyFinalAnswer(writerInput, answer, llm);
  if (!verification.passed) throw new Error("Final response failed evidence verification.");
  const claimIds = new Set(answer.paragraphs.flatMap(p => p.claimIds));
  const evidenceIds = new Set(answer.paragraphs.flatMap(p => p.evidenceIds));
  return {
    message: renderWrittenAnswer(answer),
    claims: input.claims.filter(c => claimIds.has(c.id)).map(c => ({ ...c, status: input.verifications.find(v => v.claimId === c.id)!.status, evidenceIds: input.verifications.find(v => v.claimId === c.id)!.evidenceIds.filter(id => evidenceIds.has(id)) })),
    citations: input.evidencePack.evidence.filter(e => evidenceIds.has(e.id)),
  };
}
