import assert from "node:assert/strict";
import { planDialogue } from "../src/lib/ai/planner";
import type { LlmClient } from "../src/lib/ai/client";
import type { PlanDialogueInput } from "../src/lib/ai/planner";

const base: PlanDialogueInput = {
  router: {
    queryLanguage: "ar",
    contentLevel: "B",
    route: "EXPLAIN",
    ambiguous: false,
    personalRuling: false,
    needs: ["evidence", "context"],
    conceptIds: ["fasting"],
    clarificationQuestion: null,
  },
  evidencePack: {
    question: "لماذا يصوم المسلمون؟",
    evidence: [{
      id: "evidence-1",
      chunkId: "chunk-1",
      recordId: "record-1",
      sourceId: "source-1",
      sourceType: "other_approved",
      sourceName: "Approved test source",
      text: "Controlled evidence text.",
      locator: "test:1",
      relation: "SUPPORTS",
      viewId: null,
    }],
  },
  claims: [{
    id: "claim-1",
    text: "Controlled supported claim.",
    evidenceIds: ["evidence-1"],
    status: "SUPPORTED",
  }],
  verifications: [{
    claimId: "claim-1",
    status: "SUPPORTED",
    reason: "Supported by controlled evidence.",
    evidenceIds: ["evidence-1"],
  }],
  dialogueState: {
    mainTopic: "الصيام",
    points: [{
      id: "point-1",
      label: "سبب الصيام",
      kind: "question",
      status: "active",
      parentId: null,
    }],
    activePointId: "point-1",
    resolvedPointIds: [],
    openPointIds: [],
    disputedPointIds: [],
    evidenceUsed: ["evidence-1"],
  },
};

function fake(value: unknown): LlmClient {
  return { generate: async () => JSON.stringify(value) };
}

async function main() {
  console.log("1. Normal evidence-backed plan...");
  const normal = await planDialogue(base, fake({
    nextMove: "ANSWER",
    activePointId: "point-1",
    reason: "Answer the active point using the verified claim.",
    focusClaimIds: ["claim-1"],
    focusEvidenceIds: ["evidence-1"],
    clarificationQuestion: null,
  }));
  assert.equal(normal.nextMove, "ANSWER");

  console.log("2. CLARIFY short circuit...");
  const clarify = await planDialogue({
    ...base,
    router: { ...base.router, route: "CLARIFY", ambiguous: true, clarificationQuestion: "ما المقصود تحديداً؟" },
    claims: [],
    verifications: [],
  }, fake({}));
  assert.equal(clarify.nextMove, "CLARIFY");
  assert.equal(clarify.clarificationQuestion, "ما المقصود تحديداً؟");

  console.log("3. REFERRAL short circuit...");
  const referral = await planDialogue({
    ...base,
    router: { ...base.router, route: "REFERRAL", contentLevel: "D", personalRuling: true },
    claims: [],
    verifications: [],
  }, fake({}));
  assert.equal(referral.nextMove, "REFER");

  console.log("4. Reject unsupported focus...");
  await assert.rejects(
    () => planDialogue({
      ...base,
      claims: [{ ...base.claims[0], status: "UNSUPPORTED" }],
      verifications: [{ ...base.verifications[0], status: "UNSUPPORTED" }],
    }, fake({
      nextMove: "ANSWER",
      activePointId: "point-1",
      reason: "Bad plan",
      focusClaimIds: ["claim-1"],
      focusEvidenceIds: ["evidence-1"],
      clarificationQuestion: null,
    })),
    /No supported or qualified claims/,
  );

  console.log("5. Reject invented evidence ID...");
  await assert.rejects(
    () => planDialogue(base, fake({
      nextMove: "ANSWER",
      activePointId: "point-1",
      reason: "Bad evidence",
      focusClaimIds: ["claim-1"],
      focusEvidenceIds: ["fake-evidence"],
      clarificationQuestion: null,
    })),
    /unknown evidence/,
  );

  console.log("6. Enforce disagreement move...");
  await assert.rejects(
    () => planDialogue({
      ...base,
      router: { ...base.router, route: "DISAGREEMENT", contentLevel: "C" },
    }, fake({
      nextMove: "ANSWER",
      activePointId: "point-1",
      reason: "Wrong move",
      focusClaimIds: ["claim-1"],
      focusEvidenceIds: ["evidence-1"],
      clarificationQuestion: null,
    })),
    /requires EXPLAIN_DISAGREEMENT/,
  );

  console.log("\n✓ Dialogue Planner tests passed.");
}

main().catch((error) => {
  console.error("\n✗ Dialogue Planner tests failed.");
  console.error(error);
  process.exitCode = 1;
});
