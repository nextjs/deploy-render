import assert from "node:assert/strict";
import { handleChatRequest, ChatServiceError } from "../src/lib/chat/service";
import { buildEvidencePack } from "../src/lib/rag/evidencePack";
import { buildDiscussionMap } from "../src/lib/dialogue/buildDiscussionMap";
import { buildEvidenceGraph } from "../src/lib/dialogue/buildEvidenceGraph";
import { structuredResponseSchema } from "../src/lib/schemas/response";
import { defaultChatDependencies } from "../src/lib/chat/defaultDependencies";
import type { ChatPipelineDependencies } from "../src/lib/chat/types";
import type { DialogueState } from "../src/lib/schemas/dialogue";

const profile = {
  uiLanguage: "ar" as const,
  preferredResponseLanguage: "ar",
  religiousBackground: "muslim" as const,
  goal: "learn_about_islam" as const,
  explanationDepth: "balanced" as const,
  interests: ["tawhid"],
};

const session = {
  id: "session-1",
  userProfile: profile,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const otherSession = {
  id: "session-2",
  userProfile: profile,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const conversation = {
  id: "conversation-1",
  sessionId: "session-1",
  title: null,
  primaryTopic: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function emptyState(): DialogueState {
  return {
    mainTopic: null,
    points: [],
    activePointId: null,
    resolvedPointIds: [],
    openPointIds: [],
    disputedPointIds: [],
    evidenceUsed: [],
  };
}

function makeDeps(overrides: Partial<ChatPipelineDependencies> = {}) {
  let storedState: DialogueState | null = null;
  const turns: Array<{ role: string; content: string; evidenceIds?: string[] }> = [];
  let lastRouterInput: unknown = null;
  let retrievalCalls = 0;

  const deps: ChatPipelineDependencies = {
    getSession: async (id) => id === session.id ? session : id === otherSession.id ? otherSession : null,
    getConversation: async (id) => id === conversation.id ? conversation : null,
    saveConversationTurn: async (input) => {
      turns.push(input);
      return {
        id: `turn-${turns.length}`,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        evidenceIds: input.evidenceIds ?? [],
        createdAt: new Date().toISOString(),
      };
    },
    getDialogueState: async () => storedState,
    saveDialogueState: async (_id, state) => {
      storedState = state;
      return state;
    },
    routeQuestion: async (input) => {
      lastRouterInput = input;
      if (input.question.includes("clarify")) {
        return {
          queryLanguage: "ar",
          contentLevel: "B" as const,
          route: "CLARIFY" as const,
          ambiguous: true,
          personalRuling: false,
          needs: ["clarification"],
          conceptIds: [],
          clarificationQuestion: "What exactly do you mean?",
        };
      }
      if (input.question.includes("personal")) {
        return {
          queryLanguage: "ar",
          contentLevel: "D" as const,
          route: "REFERRAL" as const,
          ambiguous: false,
          personalRuling: true,
          needs: ["referral"],
          conceptIds: [],
          clarificationQuestion: null,
        };
      }
      return {
        queryLanguage: "ar",
        contentLevel: "B" as const,
        route: "EXPLAIN" as const,
        ambiguous: false,
        personalRuling: false,
        needs: ["evidence"],
        conceptIds: ["tawhid"],
        clarificationQuestion: null,
      };
    },
    retrieveEvidence: async (input) => {
      retrievalCalls++;
      if (input.query.includes("no evidence")) return [];
      return [{
        id: "evidence-1",
        chunkId: "chunk-1",
        recordId: "record-1",
        sourceId: "source-1",
        sourceType: "terminology",
        sourceName: "Approved source",
        text: "Approved evidence text.",
        language: "ar",
        locator: "https://example.com/evidence-1",
        url: "https://example.com/evidence-1",
        score: 1,
        retrievalMethod: "keyword",
        conceptIds: ["tawhid"],
      }];
    },
    buildEvidencePack,
    updateDialogueState: async ({ previousDialogueState, userQuestion, evidenceIdsUsed }) => ({
      ...(previousDialogueState ?? emptyState()),
      mainTopic: userQuestion,
      evidenceUsed: evidenceIdsUsed ?? [],
    }),
    buildDiscussionMap,
    buildEvidenceGraph,
    ...overrides,
  };

  return {
    deps,
    getState: () => storedState,
    getTurns: () => turns,
    getLastRouterInput: () => lastRouterInput as { userProfile?: typeof profile; dialogueState?: DialogueState },
    getRetrievalCalls: () => retrievalCalls,
  };
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  await assert.rejects(promise, (error: unknown) => error instanceof ChatServiceError && error.status === status);
}

async function testInvalidRequest() {
  const { deps } = makeDeps();
  await expectStatus(handleChatRequest({ message: "x" }, deps), 400);
}

async function testUnknownSession() {
  const { deps } = makeDeps();
  await expectStatus(handleChatRequest({
    sessionId: "missing",
    conversationId: conversation.id,
    message: "question",
  }, deps), 404);
}

async function testOwnership() {
  const { deps } = makeDeps({
    getSession: async () => otherSession,
  });
  await expectStatus(handleChatRequest({
    sessionId: otherSession.id,
    conversationId: conversation.id,
    message: "question",
  }, deps), 403);
}

async function testNewAndExistingConversationContinuity() {
  const harness = makeDeps();
  const first = await handleChatRequest({
    sessionId: session.id,
    conversationId: conversation.id,
    message: "first question",
    userProfile: { ...profile, goal: "other" },
  }, harness.deps);

  assert.equal(first.status, "ok");
  assert.equal(harness.getTurns().length, 2);
  assert.equal(harness.getState()?.mainTopic, "first question");
  assert.equal(harness.getLastRouterInput().userProfile?.goal, profile.goal);

  const second = await handleChatRequest({
    sessionId: session.id,
    conversationId: conversation.id,
    message: "follow up",
  }, harness.deps);

  assert.equal(second.status, "ok");
  assert.equal(harness.getTurns().length, 4);
  assert.equal(harness.getLastRouterInput().dialogueState?.mainTopic, "first question");
  assert.equal(harness.getState()?.mainTopic, "follow up");
  assert.equal(second.dialogueState.evidenceUsed.length, 1);
}

async function testClarify() {
  const harness = makeDeps();
  const result = await handleChatRequest({
    sessionId: session.id,
    conversationId: conversation.id,
    message: "please clarify",
  }, harness.deps);
  assert.equal(result.status, "clarification_required");
  assert.equal(result.route, "CLARIFY");
  assert.equal(harness.getRetrievalCalls(), 0);
  assert.equal(harness.getTurns().length, 2);
}

async function testReferral() {
  const harness = makeDeps();
  const result = await handleChatRequest({
    sessionId: session.id,
    conversationId: conversation.id,
    message: "personal ruling",
  }, harness.deps);
  assert.equal(result.status, "referral");
  assert.equal(result.referral?.reason, "personal_fatwa");
  assert.equal(harness.getRetrievalCalls(), 0);
}

async function testInsufficientEvidence() {
  const harness = makeDeps();
  const result = await handleChatRequest({
    sessionId: session.id,
    conversationId: conversation.id,
    message: "no evidence",
  }, harness.deps);
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.referral?.reason, "insufficient_evidence");
  assert.equal(result.citations.length, 0);
}

async function testClaimGateBoundaryAndResponseContract() {
  const harness = makeDeps({
    claimGate: {
      run: async (_candidateText, evidencePack) => ({
        claims: [{
          id: "claim-1",
          text: "Evidence-backed claim.",
          evidenceIds: [evidencePack.evidence[0].id],
        }],
        verifications: [{
          claimId: "claim-1",
          status: "SUPPORTED" as const,
          reason: "Directly supported by supplied evidence.",
          evidenceIds: [evidencePack.evidence[0].id],
        }],
      }),
    },
  });

  const result = await handleChatRequest({
    sessionId: session.id,
    conversationId: conversation.id,
    message: "normal evidence",
  }, harness.deps);

  structuredResponseSchema.parse(result);
  assert.equal(result.claims[0]?.status, "SUPPORTED");
  assert.match(result.message, /claim-evidence/i);
}

async function testProductionClaimGateWiring() {
  assert.equal(typeof defaultChatDependencies.claimGate?.run, "function");
}

async function testTechnicalFailureIsSafe() {
  const harness = makeDeps({
    retrieveEvidence: async () => {
      throw new Error("secret database/api details");
    },
  });

  await expectStatus(handleChatRequest({
    sessionId: session.id,
    conversationId: conversation.id,
    message: "failure",
  }, harness.deps), 500);

  const errorTurn = harness.getTurns().at(-1);
  assert.equal(errorTurn?.role, "assistant");
  assert.equal(errorTurn?.content, "The request could not be completed safely.");
  assert.doesNotMatch(errorTurn?.content ?? "", /secret database/);
}

async function testFinalResponseBoundary() {
  const claimGate = { run: async (_text: string, pack: import("../src/lib/schemas/evidence").EvidencePack) => ({
    claims: [{ id: "c1", text: "Accepted claim", evidenceIds: [pack.evidence[0].id] }],
    verifications: [{ claimId: "c1", status: "SUPPORTED" as const, reason: "Evidence", evidenceIds: [pack.evidence[0].id] }],
  }) };
  const harness = makeDeps({ claimGate, finalResponse: async (input) => ({
    message: "الرد الذي اجتاز الفحص", claims: input.claims.map(c => ({ ...c, status: "SUPPORTED" as const })), citations: input.evidencePack.evidence,
  }) });
  const result = await handleChatRequest({ sessionId: session.id, conversationId: conversation.id, message: "normal" }, harness.deps);
  assert.equal(result.message, "الرد الذي اجتاز الفحص");
  assert.equal(harness.getTurns().at(-1)?.content, result.message);
  const blocked = makeDeps({ claimGate, finalResponse: async () => { throw new Error("Final response failed evidence verification."); } });
  await expectStatus(handleChatRequest({ sessionId: session.id, conversationId: conversation.id, message: "normal" }, blocked.deps), 500);
  assert.equal(blocked.getState(), null);
  assert.equal(blocked.getTurns().at(-1)?.content, "The request could not be completed safely.");
  const unsupported = makeDeps({
    claimGate: { run: async (text, pack) => {
      const result = await claimGate.run(text, pack);
      return { ...result, verifications: result.verifications.map(v => ({ ...v, status: "UNSUPPORTED" as const })) };
    } },
    finalResponse: async () => { throw new Error("Must not generate without accepted claims"); },
  });
  const insufficient = await handleChatRequest({ sessionId: session.id, conversationId: conversation.id, message: "normal" }, unsupported.deps);
  assert.equal(insufficient.status, "insufficient_evidence");
  assert.deepEqual(insufficient.claims, []);
  assert.deepEqual(insufficient.citations, []);
  assert.deepEqual(unsupported.getState()?.evidenceUsed, []);
  assert.equal(typeof defaultChatDependencies.finalResponse, "function");
}

async function main() {
  await testFinalResponseBoundary();
  await testInvalidRequest();
  await testUnknownSession();
  await testOwnership();
  await testNewAndExistingConversationContinuity();
  await testClarify();
  await testReferral();
  await testInsufficientEvidence();
  await testClaimGateBoundaryAndResponseContract();
  await testProductionClaimGateWiring();
  await testTechnicalFailureIsSafe();
  console.log("✓ chat API/session orchestration tests passed");
}

main().catch((error) => {
  console.error("✗ chat API/session orchestration tests failed");
  console.error(error);
  process.exitCode = 1;
});
