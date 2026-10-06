import { evidencePackSchema, type EvidencePack } from "@/lib/schemas/evidence";
import type { EvidenceCandidate, RetrievalQuery } from "@/lib/schemas/retrieval";

export function buildEvidencePack(query: RetrievalQuery, candidates: EvidenceCandidate[]): EvidencePack {
  return evidencePackSchema.parse({
    question: query.query,
    evidence: candidates.map((candidate) => ({
      id: candidate.id,
      chunkId: candidate.chunkId,
      recordId: candidate.recordId,
      sourceId: candidate.sourceId,
      sourceType: candidate.sourceType,
      sourceName: candidate.sourceName,
      text: candidate.text,
      locator: candidate.locator,
      url: candidate.url,
      relation: undefined,
      viewId: null
    }))
  });
}
