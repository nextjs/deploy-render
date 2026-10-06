import { evidenceCandidateSchema, retrievalQuerySchema, type EvidenceCandidate, type RetrievalQuery } from "@/lib/schemas/retrieval";
import { createIslamicContentMcpConnector } from "@/lib/rag/connectors/islamicContentMcp";
import { createLocalCorpusConnector } from "@/lib/rag/connectors/local";
import { deduplicateCandidates } from "@/lib/rag/deduplicate";
import { selectConnectors } from "@/lib/rag/dispatch";
import { rankCandidates } from "@/lib/rag/rank";
import type { RetrievalConnector, RetrievalResult } from "@/lib/rag/types";

function logResult(result: RetrievalResult): void {
  if (process.env.NODE_ENV === "test" || process.env.RASHID_RETRIEVAL_DEBUG === "true") {
    console.info("[RASHID retrieval]", JSON.stringify(result.diagnostics));
  }
}

export async function retrieveEvidence(input: RetrievalQuery): Promise<EvidenceCandidate[]> {
  return (await retrieveEvidenceDetailed(input)).candidates;
}

export async function retrieveEvidenceDetailed(
  input: RetrievalQuery,
  options: { connectors?: RetrievalConnector[] } = {}
): Promise<RetrievalResult> {
  const query = retrievalQuerySchema.parse(input);
  const local = options.connectors?.find((connector) => connector.name === "local") ?? createLocalCorpusConnector();
  const mcp = options.connectors?.find((connector) => connector.name === "islamic-content-mcp") ?? createIslamicContentMcpConnector();
  const selected = selectConnectors(query, { local, mcp });

  const resultsByConnector: Record<string, number> = {};
  const all: EvidenceCandidate[] = [];
  const settled = await Promise.allSettled(selected.map((connector) => connector.search(query)));

  settled.forEach((result, index) => {
    const connector = selected[index];
    if (result.status === "fulfilled") {
      const valid = result.value
        .map((candidate) => evidenceCandidateSchema.safeParse(candidate))
        .filter((parsed): parsed is { success: true; data: EvidenceCandidate } => parsed.success)
        .map((parsed) => parsed.data);
      resultsByConnector[connector.name] = valid.length;
      all.push(...valid);
    } else {
      resultsByConnector[connector.name] = 0;
      if (process.env.NODE_ENV === "test" || process.env.RASHID_RETRIEVAL_DEBUG === "true") {
        console.warn(`[RASHID retrieval] connector ${connector.name} failed: ${String(result.reason)}`);
      }
    }
  });

  const deduped = deduplicateCandidates(all);
  const ranked = rankCandidates(deduped, query).slice(0, query.topK);
  const result: RetrievalResult = {
    candidates: ranked,
    diagnostics: {
      query: query.query,
      queryLanguage: query.queryLanguage,
      selectedConnectors: selected.map((connector) => connector.name),
      resultsByConnector,
      deduplicatedCount: deduped.length,
      finalCount: ranked.length
    }
  };
  logResult(result);
  return result;
}
