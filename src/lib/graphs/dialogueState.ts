import type { DialogueState } from "@/lib/schemas/dialogue";

export function createEmptyDialogueState(): DialogueState {
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
