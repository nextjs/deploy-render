import type { EvidenceCandidate, RetrievalQuery } from "@/lib/schemas/retrieval";
import { keywordSearch } from "@/lib/rag/keywordSearch";

export function rankCandidates(candidates: EvidenceCandidate[], query: RetrievalQuery): EvidenceCandidate[] {
  const lexical = keywordSearch(query.query, candidates.map((candidate) => candidate.text));
  return candidates
    .map((candidate, index) => {
      const sourceBoost = query.sourceTypes.length === 0
        ? 0
        : query.sourceTypes.includes(candidate.sourceType) ? 0.18 : -0.08;
      const languageBoost = query.preferredSourceLanguages.includes(candidate.language)
        ? 0.12
        : candidate.language === query.queryLanguage ? 0.06 : 0;
      const conceptOverlap = query.conceptIds.filter((id) => candidate.conceptIds.includes(id)).length;
      const conceptBoost = query.conceptIds.length ? (conceptOverlap / query.conceptIds.length) * 0.12 : 0;
      const provenanceBoost = (candidate.url ? 0.05 : 0) + (candidate.locator ? 0.03 : 0);
      const finalScore = candidate.score * 0.6 + lexical[index] * 0.2 + sourceBoost + languageBoost + conceptBoost + provenanceBoost;
      return { candidate, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .map(({ candidate, finalScore }) => ({ ...candidate, score: finalScore }));
}
