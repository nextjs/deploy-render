import { getSession } from "@/lib/db/sessions";
import { getConversation } from "@/lib/db/conversations";
import { saveConversationTurn } from "@/lib/db/turns";
import { getDialogueState, saveDialogueState } from "@/lib/db/dialogueStates";
import { routeQuestion } from "@/lib/ai/router";
import { retrieveEvidence } from "@/lib/rag/retrieve";
import { buildEvidencePack } from "@/lib/rag/evidencePack";
import { updateDialogueState } from "@/lib/dialogue/updateState";
import { buildDiscussionMap } from "@/lib/dialogue/buildDiscussionMap";
import { buildEvidenceGraph } from "@/lib/dialogue/buildEvidenceGraph";
import { buildClaims } from "@/lib/ai/claimBuilder";
import { verifyClaims } from "@/lib/ai/claimEvidenceGate";
import { generateFinalResponse } from "@/lib/ai/finalPipeline";
import type { ChatPipelineDependencies } from "./types";

export const defaultChatDependencies: ChatPipelineDependencies = {
  finalResponse: generateFinalResponse,
  getSession,
  getConversation,
  saveConversationTurn,
  getDialogueState,
  saveDialogueState,
  routeQuestion,
  retrieveEvidence,
  buildEvidencePack,
  updateDialogueState,
  buildDiscussionMap,
  buildEvidenceGraph,
  claimGate: {
    async run(candidateText, evidencePack) {
      const claims = await buildClaims(candidateText, {
        question: evidencePack.question,
        evidenceIds: evidencePack.evidence.map((item) => item.id),
      });
      const verifications = await verifyClaims({ claims, evidencePack });
      return { claims, verifications };
    },
  },
};