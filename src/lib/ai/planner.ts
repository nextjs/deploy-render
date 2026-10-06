import fs from "node:fs";
import path from "node:path";
import { getLlmClient, type LlmClient } from "@/lib/ai/client";
import { dialoguePlanSchema, type DialoguePlan } from "@/lib/schemas/planner";
import type { RouterOutput } from "@/lib/schemas/router";
import type { EvidencePack } from "@/lib/schemas/evidence";
import type { AtomicClaim, ClaimVerification } from "@/lib/schemas/claims";
import type { DialogueState } from "@/lib/schemas/dialogue";
import type { UserProfile } from "@/lib/schemas/userProfile";

export type PlanDialogueInput = {
  router: RouterOutput;
  evidencePack: EvidencePack;
  claims: AtomicClaim[];
  verifications: ClaimVerification[];
  dialogueState: DialogueState;
  userProfile?: UserProfile;
};

const dialoguePlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nextMove","activePointId","reason","focusClaimIds","focusEvidenceIds","clarificationQuestion"],
  properties: {
    nextMove: { type: "string", enum: ["ANSWER","CLARIFY","DEFINE","SHOW_EVIDENCE","EXPLAIN_DISAGREEMENT","REFER"] },
    activePointId: { anyOf: [{ type: "string" }, { type: "null" }] },
    reason: { type: "string" },
    focusClaimIds: { type: "array", items: { type: "string" } },
    focusEvidenceIds: { type: "array", items: { type: "string" } },
    clarificationQuestion: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
} satisfies Record<string, unknown>;

function plannerPrompt(): string {
  return fs.readFileSync(path.join(process.cwd(), "src", "prompts", "planner.md"), "utf8");
}

function shortCircuit(input: PlanDialogueInput): DialoguePlan | null {
  if (input.router.route === "CLARIFY") {
    if (!input.router.clarificationQuestion) throw new Error("CLARIFY route requires clarificationQuestion.");
    return dialoguePlanSchema.parse({
      nextMove: "CLARIFY",
      activePointId: input.dialogueState.activePointId,
      reason: "The router requires clarification before a safe answer can be planned.",
      focusClaimIds: [],
      focusEvidenceIds: [],
      clarificationQuestion: input.router.clarificationQuestion,
    });
  }
  if (input.router.route === "REFERRAL") {
    return dialoguePlanSchema.parse({
      nextMove: "REFER",
      activePointId: input.dialogueState.activePointId,
      reason: "The router identified a referral boundary.",
      focusClaimIds: [],
      focusEvidenceIds: [],
      clarificationQuestion: null,
    });
  }
  return null;
}

function validatePlan(input: PlanDialogueInput, value: unknown): DialoguePlan {
  const plan = dialoguePlanSchema.parse(value);
  const claims = new Set(input.claims.map((claim) => claim.id));
  const verificationByClaim = new Map(input.verifications.map((item) => [item.claimId, item]));
  const evidence = new Set(input.evidencePack.evidence.map((item) => item.id));
  const points = new Set(input.dialogueState.points.map((point) => point.id));

  if (plan.activePointId && !points.has(plan.activePointId)) throw new Error("DialoguePlan references an unknown activePointId.");
  for (const claimId of plan.focusClaimIds) {
    if (!claims.has(claimId)) throw new Error(`DialoguePlan references unknown claim ${claimId}.`);
    const verification = verificationByClaim.get(claimId);
    if (!verification) throw new Error(`DialoguePlan focuses claim ${claimId} without verification.`);
    if (verification.status === "UNSUPPORTED") throw new Error(`DialoguePlan cannot focus unsupported claim ${claimId}.`);
  }
  for (const evidenceId of plan.focusEvidenceIds) {
    if (!evidence.has(evidenceId)) throw new Error(`DialoguePlan references unknown evidence ${evidenceId}.`);
  }
  if (input.router.route === "DISAGREEMENT" && plan.nextMove !== "EXPLAIN_DISAGREEMENT") {
    throw new Error("DISAGREEMENT route requires EXPLAIN_DISAGREEMENT.");
  }
  if (plan.nextMove === "CLARIFY" && !plan.clarificationQuestion) throw new Error("CLARIFY move requires clarificationQuestion.");
  if (plan.nextMove !== "CLARIFY" && plan.clarificationQuestion !== null) {
    throw new Error("clarificationQuestion must be null outside CLARIFY.");
  }
  return plan;
}

export async function planDialogue(input: PlanDialogueInput, llm: LlmClient = getLlmClient()): Promise<DialoguePlan> {
  const deterministic = shortCircuit(input);
  if (deterministic) return deterministic;

  if (!input.verifications.some((item) => item.status !== "UNSUPPORTED")) {
    throw new Error("No supported or qualified claims are available for dialogue planning.");
  }

  const raw = await llm.generate(
    ["Plan the next RASHID dialogue move from this structured input:", JSON.stringify(input, null, 2)].join("\n"),
    {
      systemInstruction: plannerPrompt(),
      responseMimeType: "application/json",
      responseJsonSchema: dialoguePlanJsonSchema,
      temperature: 0,
    },
  );

  let json: unknown;
  try { json = JSON.parse(raw); }
  catch { throw new Error("LLM returned invalid JSON for DialoguePlan."); }

  return validatePlan(input, json);
}
