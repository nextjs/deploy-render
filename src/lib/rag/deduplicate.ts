import type { EvidenceCandidate } from "@/lib/schemas/retrieval";

function normalizedText(text: string): string {
  return text.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function provenanceQuality(candidate: EvidenceCandidate): number {
  return (candidate.url ? 2 : 0) + (candidate.locator ? 1 : 0) + (candidate.sourceId ? 1 : 0);
}

export function deduplicateCandidates(candidates: EvidenceCandidate[]): EvidenceCandidate[] {
  const byKey = new Map<string, EvidenceCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.sourceId}|${candidate.locator}|${normalizedText(candidate.text)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }
    const candidateWins =
      provenanceQuality(candidate) > provenanceQuality(existing) ||
      (provenanceQuality(candidate) === provenanceQuality(existing) && candidate.score > existing.score);
    if (candidateWins) byKey.set(key, candidate);
  }
  return [...byKey.values()];
}
