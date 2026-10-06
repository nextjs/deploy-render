import { createIslamicContentMcpConnector } from "../src/lib/rag/connectors/islamicContentMcp";
import type { RetrievalQuery } from "../src/lib/schemas/retrieval";

async function main() {
  delete process.env.RASHID_DISABLE_MCP;

  const connector = createIslamicContentMcpConnector();

  const query: RetrievalQuery = {
    query: "What is Tawhid?",
    queryLanguage: "en",
    route: "EXPLAIN",
    contentLevel: "B",
    preferredResponseLanguage: "en",
    preferredSourceLanguages: ["en"],
    sourceTypes: ["terminology"],
    conceptIds: [],
    topK: 3,
  };

  console.log("Testing Islamic Content MCP...");
  console.log(`Query: ${query.query}`);

  const candidates = await connector.search(query);

  console.log(
    JSON.stringify(
      {
        Connector: connector.name,
        "Candidate count": candidates.length,
        Results: candidates.map((candidate) => ({
          Source: candidate.sourceName,
          SourceType: candidate.sourceType,
          Language: candidate.language,
          Locator: candidate.locator,
          HasURL: Boolean(candidate.url),
          HasText: Boolean(candidate.text),
        })),
      },
      null,
      2
    )
  );

  if (candidates.length === 0) {
    throw new Error("MCP returned no candidates.");
  }

  for (const candidate of candidates) {
    if (!candidate.text || !candidate.locator) {
      throw new Error("MCP returned a candidate without required provenance.");
    }
  }

  console.log("✓ live Islamic Content MCP test passed.");
}

main().catch((error) => {
  console.error("✗ live Islamic Content MCP test failed.");
  console.error(error);
  process.exit(1);
});
