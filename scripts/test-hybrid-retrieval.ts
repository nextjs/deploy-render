import { buildEvidencePack } from "../src/lib/rag/evidencePack";
import { retrieveEvidenceDetailed } from "../src/lib/rag/retrieve";
import type { RetrievalConnector } from "../src/lib/rag/types";
import type { EvidenceCandidate, RetrievalQuery } from "../src/lib/schemas/retrieval";

function candidate(
  id: string,
  sourceType: EvidenceCandidate["sourceType"],
  text: string,
  locator: string,
  score = 0.8,
  url?: string
): EvidenceCandidate {
  return {
    id,
    chunkId: `${id}-chunk`,
    recordId: `${id}-record`,
    sourceId: `TEST-SOURCE-${id}`,
    sourceType,
    sourceName: id.startsWith("MCP") ? "Islamic Content MCP" : "TEST LOCAL",
    text,
    language: "en",
    locator,
    url,
    score,
    retrievalMethod: "hybrid",
    conceptIds: []
  };
}

const base: Omit<RetrievalQuery, "query" | "route" | "sourceTypes"> = {
  queryLanguage: "en",
  contentLevel: "B",
  preferredResponseLanguage: "en",
  preferredSourceLanguages: ["en"],
  conceptIds: [],
  topK: 5
};

async function main() {
  const localCandidate = candidate(
    "LOCAL-QURAN",
    "quran",
    "Prayer is an act of worship.",
    "fixture/quran/1",
    0.7
  );

  const mcpDuplicate = candidate(
    "MCP-QURAN",
    "quran",
    "Prayer is an act of worship.",
    "fixture/quran/1",
    0.9,
    "https://example.invalid/quran/1"
  );

  mcpDuplicate.sourceId = localCandidate.sourceId;

  const mcpDistinct = candidate(
    "MCP-HADITH",
    "hadith",
    "Good character is encouraged.",
    "fixture/hadith/1",
    0.85,
    "https://example.invalid/hadith/1"
  );

  const local: RetrievalConnector = {
    name: "local",
    async search(query) {
      if (query.query.includes("Prayer")) return [localCandidate];
      return [];
    }
  };

  const mcp: RetrievalConnector = {
    name: "islamic-content-mcp",
    async search(query) {
      if (query.query.includes("Prayer")) return [mcpDuplicate];
      if (query.query.includes("Character")) return [mcpDistinct];
      return [];
    }
  };

  const failingMcp: RetrievalConnector = {
    name: "islamic-content-mcp",
    async search() {
      throw new Error("simulated MCP outage");
    }
  };

  const quranQuery: RetrievalQuery = {
    ...base,
    query: "Prayer",
    route: "CLARIFY",
    sourceTypes: ["quran"]
  };

  const quranResult = await retrieveEvidenceDetailed(quranQuery, {
    connectors: [local, mcp]
  });

  if (!quranResult.diagnostics.selectedConnectors.includes("islamic-content-mcp")) {
    throw new Error("Quran retrieval did not dispatch to MCP.");
  }
  if (!quranResult.diagnostics.selectedConnectors.includes("local")) {
    throw new Error("Quran retrieval did not retain local corpus.");
  }
  if (quranResult.diagnostics.deduplicatedCount !== 1 || quranResult.candidates.length !== 1) {
    throw new Error("Duplicate evidence was not collapsed.");
  }
  if (!quranResult.candidates[0].url) {
    throw new Error("Higher-provenance MCP candidate did not win deduplication.");
  }

  const broadQuery: RetrievalQuery = {
    ...base,
    query: "Character",
    route: "EXPLAIN",
    sourceTypes: []
  };

  const broadResult = await retrieveEvidenceDetailed(broadQuery, {
    connectors: [local, mcp]
  });

  if (broadResult.diagnostics.selectedConnectors.join("|") !== "islamic-content-mcp|local") {
    throw new Error("Broad EXPLAIN dispatch did not select MCP + local.");
  }
  if (broadResult.candidates.length !== 1 || broadResult.candidates[0].sourceType !== "hadith") {
    throw new Error("Broad retrieval returned an unexpected result.");
  }

  const fallbackResult = await retrieveEvidenceDetailed(quranQuery, {
    connectors: [local, failingMcp]
  });

  if (fallbackResult.candidates.length !== 1 || fallbackResult.diagnostics.resultsByConnector["islamic-content-mcp"] !== 0) {
    throw new Error("Local fallback did not survive an MCP connector failure.");
  }

  const emptyQuery: RetrievalQuery = {
    ...base,
    query: "No matching evidence",
    route: "CLARIFY",
    sourceTypes: []
  };

  const emptyResult = await retrieveEvidenceDetailed(emptyQuery, {
    connectors: [local, mcp]
  });

  if (emptyResult.candidates.length !== 0 || emptyResult.diagnostics.finalCount !== 0) {
    throw new Error("No-evidence case did not return zero candidates.");
  }

  const pack = buildEvidencePack(quranQuery, quranResult.candidates);
  if (pack.evidence.length !== 1 || pack.evidence[0].url !== "https://example.invalid/quran/1") {
    throw new Error("EvidencePack did not preserve candidate provenance.");
  }

  console.log("✓ hybrid retrieval dispatch, dedup, ranking, fallback, and EvidencePack tests passed.");
}

main().catch((error) => {
  console.error("✗ hybrid retrieval smoke test failed.");
  console.error(error);
  process.exit(1);
});
