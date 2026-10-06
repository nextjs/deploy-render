import fs from "node:fs";
import path from "node:path";
import { getLlmClient } from "@/lib/ai/client";
import {
  routerInputSchema,
  routerOutputSchema,
  type RouterInput,
  type RouterOutput,
} from "@/lib/schemas/router";

const routerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "queryLanguage",
    "contentLevel",
    "route",
    "ambiguous",
    "personalRuling",
    "needs",
    "conceptIds",
    "clarificationQuestion",
  ],
  properties: {
    queryLanguage: {
      type: "string",
      description: "BCP-47-style language tag for the current user question.",
    },
    contentLevel: {
      type: "string",
      enum: ["A", "B", "C", "D"],
    },
    route: {
      type: "string",
      enum: ["LOOKUP", "EXPLAIN", "DISAGREEMENT", "REFERRAL", "CLARIFY"],
    },
    ambiguous: { type: "boolean" },
    personalRuling: { type: "boolean" },
    needs: {
      type: "array",
      items: { type: "string" },
    },
    conceptIds: {
      type: "array",
      items: { type: "string" },
    },
    clarificationQuestion: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
} satisfies Record<string, unknown>;

function loadRouterPrompt(): string {
  const promptPath = path.join(process.cwd(), "src", "prompts", "router.md");
  return fs.readFileSync(promptPath, "utf8");
}

function buildRuntimeInput(input: RouterInput): string {
  return [
    "Classify the following RASHID RouterInput.",
    "Return only the structured RouterOutput requested by the system policy.",
    "",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

function assertRouterInvariants(output: RouterOutput): RouterOutput {
  if (output.route === "CLARIFY") {
    if (!output.ambiguous || !output.clarificationQuestion) {
      throw new Error(
        "Invalid router result: CLARIFY requires ambiguous=true and a clarificationQuestion.",
      );
    }
  } else if (output.ambiguous) {
    throw new Error(
      "Invalid router result: ambiguous=true requires route=CLARIFY.",
    );
  } else if (output.clarificationQuestion !== null) {
    throw new Error(
      "Invalid router result: clarificationQuestion must be null unless route=CLARIFY.",
    );
  }

  if (output.personalRuling && output.route !== "REFERRAL") {
    throw new Error(
      "Invalid router result: personalRuling=true requires route=REFERRAL.",
    );
  }

  if (output.route === "REFERRAL" && output.contentLevel !== "D") {
    throw new Error(
      "Invalid router result: REFERRAL requires contentLevel=D.",
    );
  }

  return output;
}

export async function routeQuestion(rawInput: RouterInput): Promise<RouterOutput> {
  const input = routerInputSchema.parse(rawInput);
  const llm = getLlmClient();

  const raw = await llm.generate(buildRuntimeInput(input), {
    systemInstruction: loadRouterPrompt(),
    responseMimeType: "application/json",
    responseJsonSchema: routerJsonSchema,
    temperature: 0,
  });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Gemini returned invalid JSON for RouterOutput.");
  }

  return assertRouterInvariants(routerOutputSchema.parse(json));
}
