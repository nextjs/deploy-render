import fs from "node:fs";
import path from "node:path";
import { chunkRecordSchema, type ChunkRecord } from "@/lib/schemas/corpus";
import type { EvidenceCandidate, RetrievalQuery } from "@/lib/schemas/retrieval";
import { keywordSearch } from "@/lib/rag/keywordSearch";
import type { LocalConnectorOptions, RetrievalConnector } from "@/lib/rag/types";

function loadChunks(filePath: string): ChunkRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return [];
  const values: unknown[] = filePath.endsWith(".jsonl")
    ? raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : JSON.parse(raw);
  return values
    .map((value) => chunkRecordSchema.safeParse(value))
    .filter((result): result is { success: true; data: ChunkRecord } => result.success)
    .map((result) => result.data);
}

function languageBoost(language: string, query: RetrievalQuery): number {
  if (query.preferredSourceLanguages.includes(language)) return 0.12;
  if (language === query.queryLanguage) return 0.08;
  return 0;
}

export class LocalCorpusConnector implements RetrievalConnector {
  readonly name = "local";
  constructor(private readonly options: LocalConnectorOptions = {}) {}

  async search(query: RetrievalQuery): Promise<EvidenceCandidate[]> {
    const filePath = this.options.path ?? process.env.RASHID_LOCAL_CORPUS_PATH ?? path.join(process.cwd(), "data/processed/dorar-hadith-chunks.jsonl");
    const chunks = this.options.chunks ?? loadChunks(filePath);
    const eligible = chunks.filter((chunk) => query.sourceTypes.length === 0 || query.sourceTypes.includes(chunk.sourceType));
    const scores = keywordSearch(query.query, eligible.map((chunk) => chunk.text));

    return eligible
      .map((chunk, index) => ({
        id: chunk.chunkId,
        chunkId: chunk.chunkId,
        recordId: chunk.recordId,
        sourceId: chunk.sourceId,
        sourceType: chunk.sourceType,
        sourceName: String(chunk.metadata.sourceName ?? chunk.sourceId),
        text: chunk.text,
        language: chunk.language,
        locator: typeof chunk.metadata.grading === "string"
          ? `${chunk.locator} | grading=${chunk.metadata.grading}`
          : chunk.locator,
        url: chunk.url,
        score: scores[index] > 0 ? scores[index] + languageBoost(chunk.language, query) : 0,
        retrievalMethod: "keyword" as const,
        conceptIds: chunk.conceptIds
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(query.topK * 2, 8));
  }
}

export function createLocalCorpusConnector(options: LocalConnectorOptions = {}): RetrievalConnector {
  return new LocalCorpusConnector(options);
}
