import fs from "node:fs";
import path from "node:path";
import { getLlmClient } from "@/lib/ai/client";
import {
  dialogueStateSchema,
  type DialogueState,
} from "@/lib/schemas/dialogue";

export type UpdateDialogueStateInput = {
  previousDialogueState?: DialogueState;
  userQuestion: string;
  verifiedResponseSummary: string;
  evidenceIdsUsed?: string[];
};

const dialogueStateJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mainTopic",
    "points",
    "activePointId",
    "resolvedPointIds",
    "openPointIds",
    "disputedPointIds",
    "evidenceUsed",
  ],
  properties: {
    mainTopic: { anyOf: [{ type: "string" }, { type: "null" }] },
    points: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "kind", "status", "parentId"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          kind: {
            type: "string",
            enum: ["question", "concept", "claim", "misconception", "viewpoint", "summary"],
          },
          status: {
            type: "string",
            enum: ["active", "resolved", "open", "disputed"],
          },
          parentId: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
      },
    },
    activePointId: { anyOf: [{ type: "string" }, { type: "null" }] },
    resolvedPointIds: { type: "array", items: { type: "string" } },
    openPointIds: { type: "array", items: { type: "string" } },
    disputedPointIds: { type: "array", items: { type: "string" } },
    evidenceUsed: { type: "array", items: { type: "string" } },
  },
} satisfies Record<string, unknown>;

function prompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src", "prompts", "dialogue-state.md"),
    "utf8",
  );
}

function normalizeAndValidateState(
  state: DialogueState,
  allowedEvidenceIds: string[],
): DialogueState {
  const ids = state.points.map((point) => point.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("DialogueState contains duplicate point IDs.");
  }

  const pointById = new Map(state.points.map((point) => [point.id, point]));
  for (const point of state.points) {
    if (point.parentId && !pointById.has(point.parentId)) {
      throw new Error(`Dialogue point ${point.id} references an unknown parent.`);
    }
  }

  const activePoints = state.points.filter((point) => point.status === "active");
  if (activePoints.length > 1) {
    throw new Error("DialogueState may contain at most one active point.");
  }

  const allowed = new Set(allowedEvidenceIds);
  if (state.evidenceUsed.some((id) => !allowed.has(id))) {
    throw new Error("DialogueState invented an evidence ID.");
  }

  // These fields are derived from point statuses. Recompute them instead of
  // failing a valid semantic state because the LLM duplicated bookkeeping badly.
  const normalized: DialogueState = {
    ...state,
    activePointId: activePoints[0]?.id ?? null,
    resolvedPointIds: state.points
      .filter((point) => point.status === "resolved")
      .map((point) => point.id),
    openPointIds: state.points
      .filter((point) => point.status === "open")
      .map((point) => point.id),
    disputedPointIds: state.points
      .filter((point) => point.status === "disputed")
      .map((point) => point.id),
    evidenceUsed: [...new Set(state.evidenceUsed)],
  };

  return dialogueStateSchema.parse(normalized);
}

export async function updateDialogueState(
  input: UpdateDialogueStateInput,
): Promise<DialogueState> {
  const previous = input.previousDialogueState
    ? dialogueStateSchema.parse(input.previousDialogueState)
    : dialogueStateSchema.parse({});

  const evidenceIdsUsed = [...new Set(input.evidenceIdsUsed ?? [])];
  const raw = await getLlmClient().generate(
    [
      "Update the dialogue state using this turn:",
      JSON.stringify({
        previousDialogueState: previous,
        userQuestion: input.userQuestion,
        verifiedResponseSummary: input.verifiedResponseSummary,
        evidenceIdsUsed,
      }, null, 2),
    ].join("\n"),
    {
      systemInstruction: prompt(),
      responseMimeType: "application/json",
      responseJsonSchema: dialogueStateJsonSchema,
      temperature: 0,
    },
  );

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("LLM returned invalid JSON for DialogueState.");
  }

  return normalizeAndValidateState(dialogueStateSchema.parse(json), evidenceIdsUsed);
}
