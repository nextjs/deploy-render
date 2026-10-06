import fs from "node:fs";
import path from "node:path";
import { createLocalCorpusConnector } from "../src/lib/rag/connectors/local";
import { retrieveEvidenceDetailed } from "../src/lib/rag/retrieve";
import type { RetrievalConnector } from "../src/lib/rag/types";

async function main() {
  process.env.RASHID_DISABLE_MCP = "true";

  const questions = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data/tests/retrieval-questions.json"), "utf8")
  );

  const chunks = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data/mock/retrieval-chunks.json"), "utf8")
  );

  const local = createLocalCorpusConnector({ chunks });
  const mcp: RetrievalConnector = {
    name: "islamic-content-mcp",
    async search() {
      return [];
    }
  };

  let hits = 0;
  let evaluated = 0;

  for (const item of questions) {
    if (!item.expectedLocatorContains?.length) continue;
    evaluated += 1;

    const result = await retrieveEvidenceDetailed(
      {
        query: item.question,
        queryLanguage: item.queryLanguage,
        route: item.route,
        contentLevel: item.contentLevel,
        preferredResponseLanguage: item.queryLanguage,
        preferredSourceLanguages: [item.queryLanguage],
        sourceTypes: item.sourceTypes,
        conceptIds: [],
        topK: item.topK
      },
      { connectors: [local, mcp] }
    );

    const hit = result.candidates.some(
      (candidate) =>
        item.expectedSourceTypes.includes(candidate.sourceType) &&
        item.expectedLocatorContains.some((locator: string) =>
          candidate.locator.includes(locator)
        )
    );

    if (hit) hits += 1;
  }

  const percent = evaluated ? (hits / evaluated) * 100 : 100;
  console.log(`Retrieval Hit@5: ${hits}/${evaluated} = ${percent.toFixed(1)}%`);

  if (hits !== evaluated) {
    throw new Error("Retrieval Hit@5 failed.");
  }

  console.log("✓ retrieval Hit@5 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
