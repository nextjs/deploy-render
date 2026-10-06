import type { AtomicClaim, ClaimVerification } from "@/lib/schemas/claims";
import type { EvidencePack } from "@/lib/schemas/evidence";

export type ClaimGateResult = {
  claims: AtomicClaim[];
  verifications: ClaimVerification[];
};

export type ClaimGateDependency = {
  run: (candidateText: string, evidencePack: EvidencePack) => Promise<ClaimGateResult>;
};

export type ChatPipelineDependencies = {
  getSession: typeof import("@/lib/db/sessions").getSession;
  getConversation: typeof import("@/lib/db/conversations").getConversation;
  saveConversationTurn: typeof import("@/lib/db/turns").saveConversationTurn;
  getDialogueState: typeof import("@/lib/db/dialogueStates").getDialogueState;
  saveDialogueState: typeof import("@/lib/db/dialogueStates").saveDialogueState;
  routeQuestion: typeof import("@/lib/ai/router").routeQuestion;
  retrieveEvidence: typeof import("@/lib/rag/retrieve").retrieveEvidence;
  buildEvidencePack: typeof import("@/lib/rag/evidencePack").buildEvidencePack;
  updateDialogueState: typeof import("@/lib/dialogue/updateState").updateDialogueState;
  buildDiscussionMap: typeof import("@/lib/dialogue/buildDiscussionMap").buildDiscussionMap;
  buildEvidenceGraph: typeof import("@/lib/dialogue/buildEvidenceGraph").buildEvidenceGraph;
  claimGate?: ClaimGateDependency;
  finalResponse?: typeof import("@/lib/ai/finalPipeline").generateFinalResponse;
};