import fs from "node:fs";
import path from "node:path";
import { chunkRecordSchema, type ChunkRecord } from "../src/lib/schemas/corpus";
import { buildEvidencePack } from "../src/lib/rag/evidencePack";
import { createLocalCorpusConnector } from "../src/lib/rag/connectors/local";
import { retrieveEvidenceDetailed } from "../src/lib/rag/retrieve";
import type { RetrievalConnector } from "../src/lib/rag/types";
import type { RetrievalQuery } from "../src/lib/schemas/retrieval";

process.env.RASHID_DISABLE_MCP = "true";

async function main() {
  const fixturePath = path.join(
    process.cwd(),
    "data/mock/retrieval-chunks.json"
  );

  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  const chunks: ChunkRecord[] = raw.map((value: unknown) =>
    chunkRecordSchema.parse(value)
  );

  const local = createLocalCorpusConnector({ chunks });

  const noopMcp: RetrievalConnector = {
    name: "islamic-content-mcp",
    async search() {
      return [];
    }
  };

  const base = {
    route: "EXPLAIN" as const,
    contentLevel: "B" as const,
    preferredResponseLanguage: "en",
    preferredSourceLanguages: ["en"],
    conceptIds: [],
    topK: 5
  };

  const cases = [
    {
      label: "terminology",
      question: "What is Tawhid?",
      sourceTypes: ["terminology"] as RetrievalQuery["sourceTypes"]
    },
    {
      label: "Quran",
      question: "What does the Quran say about prayer?",
      sourceTypes: ["quran"] as RetrievalQuery["sourceTypes"]
    },
    {
      label: "Hadith",
      question: "Find a hadith about good character.",
      sourceTypes: ["hadith"] as RetrievalQuery["sourceTypes"]
    },
    {
      label: "explanation",
      question: "Explain worship in simple terms.",
      sourceTypes: [] as RetrievalQuery["sourceTypes"]
    },
    {
      label: "multilingual",
      question: "What is Tawhid?",
      sourceTypes: [] as RetrievalQuery["sourceTypes"]
    },
    {
      label: "no evidence",
      question: "What is the TEST-UNRELATED-XYZ topic?",
      sourceTypes: [] as RetrievalQuery["sourceTypes"]
    }
  ];

  for (const testCase of cases) {
    const query: RetrievalQuery = {
      ...base,
      query: testCase.question,
      queryLanguage: "en",
      sourceTypes: testCase.sourceTypes
    };

    const result = await retrieveEvidenceDetailed(query, {
      connectors: [local, noopMcp]
    });

    console.log(
      JSON.stringify(
        {
          Question: testCase.question,
          "Detected/query language": query.queryLanguage,
          "Connectors used": result.diagnostics.selectedConnectors,
          "Candidate count": result.candidates.length,
          "Top candidates": result.candidates.map((candidate) => ({
            Source: candidate.sourceName,
            Locator: candidate.locator,
            Language: candidate.language,
            Score: Number(candidate.score.toFixed(3))
          }))
        },
        null,
        2
      )
    );

    buildEvidencePack(query, result.candidates);
  }

  console.log(
    "✓ retrieval smoke tests completed with TEST FIXTURE ONLY local data."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});