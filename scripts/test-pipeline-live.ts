import assert from "node:assert/strict";
import { PipelineReport } from "./pipeline-report";
import fs from "node:fs";
import path from "node:path";
import { createSession } from "../src/lib/db/sessions";
import { createConversation } from "../src/lib/db/conversations";
import { listConversationTurns } from "../src/lib/db/turns";
import { getDialogueState } from "../src/lib/db/dialogueStates";
import { defaultChatDependencies } from "../src/lib/chat/defaultDependencies";
import { handleChatRequest } from "../src/lib/chat/service";
import { retrieveEvidenceDetailed } from "../src/lib/rag/retrieve";
import { generateFinalResponse } from "../src/lib/ai/finalPipeline";
import { getLlmClient } from "../src/lib/ai/client";
import { structuredResponseSchema } from "../src/lib/schemas/response";
import type { UserProfile } from "../src/lib/schemas/userProfile";

const args = process.argv.slice(2);
const questionIndex = args.indexOf("--question");
const reportIndex = args.indexOf("--report-dir");
const report = new PipelineReport(reportIndex >= 0 ? args[reportIndex + 1] : undefined,
  [process.env.GEMINI_API_KEY ?? "", process.env.DATABASE_URL ?? ""]);
const trace = (stage: string, data: unknown) => {
  report.record(stage, data);
  if (args.includes("--verbose")) console.log(JSON.stringify({ stage, data }, null, 2));
  else console.log(`[${stage}]`);
};
async function main() {
  if (reportIndex >= 0 && !args[reportIndex + 1]) throw new Error("--report-dir requires a directory.");
  for (const key of ["GEMINI_API_KEY", "DATABASE_URL"]) {
    if (!process.env[key]) throw new Error(`${key} is missing in .env.local.`);
  }
  if (questionIndex >= 0 && !args[questionIndex + 1]) throw new Error("--question requires a question.");
  const corpusPath = process.env.RASHID_LOCAL_CORPUS_PATH ?? path.join(process.cwd(), "data/processed/dorar-hadith-chunks.jsonl");
  const localChunks = fs.existsSync(corpusPath) ? fs.readFileSync(corpusPath, "utf8").split(/\r?\n/).filter(s => s.trim()).length : 0;
  trace("preflight", { localChunks, mcpEnabled: process.env.RASHID_DISABLE_MCP !== "true", models: process.env.LLM_MODELS ?? "default" });
  if (!localChunks) console.warn("Local corpus is empty/missing. This run relies on the real MCP connector; it does not validate local corpus ingestion.");
  if (!localChunks && process.env.RASHID_DISABLE_MCP === "true") throw new Error("No real evidence source is enabled.");
  if (args.includes("--check")) { report.finish("check_complete"); return; }
  const profile: UserProfile = {
    uiLanguage: "ar", preferredResponseLanguage: "ar", goal: "learn_about_islam",
    explanationDepth: "balanced", interests: [],
  };
  const session = await createSession(profile);
  trace("session", { id: session.id });
  const tests = questionIndex >= 0
    ? [{ name: "custom", question: args[questionIndex + 1], expected: "ok", language: "ar", depth: "balanced" as const }]
    : [
      { name: "Arabic explanation", question: "لماذا يصوم المسلمون في رمضان؟", expected: "ok", language: "ar", depth: "balanced" as const },
      { name: "Follow-up in same conversation", question: "اشرح الحكمة من صيام رمضان بشكل أبسط", expected: "ok", language: "ar", depth: "balanced" as const, followUp: true },
      { name: "English brief answer", question: "Why do Muslims fast during Ramadan?", expected: "ok", language: "en", depth: "brief" as const },
      { name: "Disagreement", question: "لماذا يختلف العلماء في فهم بعض الأحكام؟ ألا يعني هذا وجود تناقض؟", expected: "ok", language: "ar", depth: "balanced" as const },
      { name: "Clarification boundary", question: "لماذا فعلوا ذلك؟", expected: "clarification_required", language: "ar", depth: "balanced" as const },
      { name: "Personal ruling boundary", question: "لدي ظروف خاصة في زواجي، هل يجوز لي شخصياً أن أطلق زوجتي الآن؟", expected: "referral", language: "ar", depth: "balanced" as const },
    ];
  let conversationId = "";
  let passed = 0;
  for (const test of tests) {
    console.log(`\n=== ${test.name} ===`);
    report.startCase(test.name, test.question, test.expected);
    const currentProfile = { ...profile, preferredResponseLanguage: test.language, explanationDepth: test.depth };
    await import("../src/lib/db/sessions").then(m => m.updateSessionProfile(session.id, currentProfile));
    if (!("followUp" in test && test.followUp)) {
      conversationId = (await createConversation({ sessionId: session.id, title: `LIVE TEST: ${test.name}` })).id;
    }
    let lastStage = "start";
    let finalCalls = 0;
    const stage = (name: string, value: unknown) => { lastStage = name; trace(name, value); };
    const llm = getLlmClient();
    const deps = {
      ...defaultChatDependencies,
      routeQuestion: async (input: Parameters<typeof defaultChatDependencies.routeQuestion>[0]) => {
        stage("router:start", { question: input.question, previousState: input.dialogueState });
        const result = await defaultChatDependencies.routeQuestion(input);
        stage("router:result", result); return result;
      },
      retrieveEvidence: async (input: Parameters<typeof retrieveEvidenceDetailed>[0]) => {
        stage("retrieval:start", input);
        const result = await retrieveEvidenceDetailed(input);
        stage("retrieval:result", result); return result.candidates;
      },
      claimGate: { run: async (text: string, pack: Parameters<NonNullable<typeof defaultChatDependencies.claimGate>["run"]>[1]) => {
        stage("claim-gate:start", pack);
        const result = await defaultChatDependencies.claimGate!.run(text, pack);
        stage("claim-gate:result", result); return result;
      } },
      finalResponse: async (input: Parameters<typeof generateFinalResponse>[0]) => generateFinalResponse(input, {
        generate: async (prompt, options) => {
          const name = ["K planner", "L writer", "M verifier"][finalCalls++];
          stage(`${name}:start`, {});
          const raw = await llm.generate(prompt, options);
          stage(`${name}:result`, raw); return raw;
        },
      }),
      updateDialogueState: async (input: Parameters<typeof defaultChatDependencies.updateDialogueState>[0]) => {
        stage("dialogue-state:start", input);
        const result = await defaultChatDependencies.updateDialogueState(input);
        stage("dialogue-state:result", result); return result;
      },
    };
    try {
      const before = await listConversationTurns(conversationId);
      const result = structuredResponseSchema.parse(await handleChatRequest({ sessionId: session.id, conversationId, message: test.question }, deps));
      stage("final-response", result);
      assert.equal(result.status, test.expected, "Unexpected status; inspect routing/retrieval/verification trace.");
      if (result.status === "ok") {
        assert.equal(finalCalls, 3, "K/L/M must all run for an evidence-backed answer.");
        assert.ok(result.message.trim() && result.claims.length && result.citations.length);
        const ids = new Set(result.citations.map(e => e.id));
        for (const claim of result.claims) {
          assert.notEqual(claim.status, "UNSUPPORTED");
          assert.ok(claim.evidenceIds.length && claim.evidenceIds.every(id => ids.has(id)));
        }
      } else {
        assert.equal(finalCalls, 0, "Clarification/referral must skip K/L/M.");
        assert.deepEqual(result.claims, []); assert.deepEqual(result.citations, []);
      }
      const after = await listConversationTurns(conversationId);
      assert.equal(after.length, before.length + 2);
      assert.ok(after.some(t => t.role === "assistant" && t.content === result.message));
      const state = await getDialogueState(conversationId);
      assert.deepEqual(state, result.dialogueState);
      for (const evidence of result.citations) assert.ok(state?.evidenceUsed.includes(evidence.id));
      stage("PASS", { conversationId, status: result.status }); passed++;
    } catch (error) {
      trace("FAIL", { conversationId, lastStage, message: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(`\nLive pipeline: ${passed}/${tests.length} passed. Test sessions and turns remain in the configured database.`);
  console.log("Review the Arabic/English prose, sources and quotations manually; an automatic pass does not certify religious accuracy.");
  report.finish(passed === tests.length ? "passed" : "failed");
  if (passed !== tests.length) process.exitCode = 1;
}
main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  report.finish("error", message); console.error(message); process.exitCode = 1;
}).finally(() => {
  console.log(`Readable report: ${report.htmlPath}`);
  console.log(`Structured report: ${report.jsonPath}`);
});
