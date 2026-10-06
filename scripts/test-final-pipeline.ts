import assert from "node:assert/strict";
import { input, answer, fake } from "./test-writer";
import { verifyFinalAnswer } from "../src/lib/ai/verifier";
import { generateFinalResponse } from "../src/lib/ai/finalPipeline";
const verdict = { passed: true, paragraphs: [{ index: 0, supported: true, qualificationsPreserved: true, languageCorrect: true, moveFollowed: true, reason: "All assertions match linked evidence." }] };
async function main() {
  assert.equal((await verifyFinalAnswer(input, answer, fake(verdict))).passed, true);
  for (const field of ["supported", "qualificationsPreserved", "languageCorrect", "moveFollowed"]) {
    const rejected = { passed: false, paragraphs: [{ ...verdict.paragraphs[0], [field]: false }] };
    assert.equal((await verifyFinalAnswer(input, answer, fake(rejected))).passed, false);
    await assert.rejects(() => verifyFinalAnswer(input, answer, fake({ ...rejected, passed: true })), /inconsistent/);
  }
  for (const paragraphs of [[], [verdict.paragraphs[0], verdict.paragraphs[0]], [{ ...verdict.paragraphs[0], index: 1 }]]) {
    await assert.rejects(() => verifyFinalAnswer(input, answer, fake({ ...verdict, paragraphs })), /exactly once/);
  }
  await assert.rejects(() => verifyFinalAnswer(input, answer, { generate: async () => "invalid" }), /invalid JSON/);
  let calls = 0;
  const outputs = [input.plan, answer, verdict];
  const generated = await generateFinalResponse(input, { generate: async () => JSON.stringify(outputs[calls++]) });
  assert.equal(calls, 3);
  assert.equal(generated.message, "حقيقة تجريبية");
  assert.deepEqual(generated.citations.map(c => c.id), ["e1"]);
  calls = 0;
  await assert.rejects(() => generateFinalResponse(input, { generate: async () => JSON.stringify([input.plan, answer, { passed: false, paragraphs: [{ ...verdict.paragraphs[0], supported: false }] }][calls++]) }), /failed evidence verification/);
  console.log("Final verifier and K→L→M integration tests passed.");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
