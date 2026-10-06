import fs from "node:fs";
import path from "node:path";
import { chatRequestSchema } from "../src/lib/schemas/api";
import { evidencePackSchema } from "../src/lib/schemas/evidence";
import { structuredResponseSchema } from "../src/lib/schemas/response";
import { routerOutputSchema } from "../src/lib/schemas/router";
import { sessionSchema } from "../src/lib/schemas/session";

const root = process.cwd();

function loadJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

const cases = [
  ["session", sessionSchema, "data/mock/session.json"],
  ["chat request", chatRequestSchema, "data/mock/chat-request.json"],
  ["router output", routerOutputSchema, "data/mock/router-output.json"],
  ["evidence pack", evidencePackSchema, "data/mock/evidence-pack.json"],
  ["normal response", structuredResponseSchema, "data/mock/normal-answer.json"],
  ["clarification response", structuredResponseSchema, "data/mock/clarification-answer.json"],
  ["disagreement response", structuredResponseSchema, "data/mock/disagreement-answer.json"],
  ["referral response", structuredResponseSchema, "data/mock/referral-answer.json"],
  ["no-evidence response", structuredResponseSchema, "data/mock/no-evidence-answer.json"],
] as const;

let failed = false;

for (const [name, schema, file] of cases) {
  const result = schema.safeParse(loadJson(file));
  if (result.success) {
    console.log(`✓ ${name}: ${file}`);
  } else {
    failed = true;
    console.error(`✗ ${name}: ${file}`);
    console.error(result.error.flatten());
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("\nAll canonical mocks match Contracts v1.");
}
