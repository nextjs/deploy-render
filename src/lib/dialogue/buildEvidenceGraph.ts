import {
  evidenceGraphSchema,
  type EvidenceGraph,
} from "@/lib/schemas/graph";
import type { AtomicClaim, ClaimVerification } from "@/lib/schemas/claims";
import type { EvidenceItem } from "@/lib/schemas/evidence";

type BuildEvidenceGraphInput = {
  claims: AtomicClaim[];
  evidence: EvidenceItem[];
  verifications?: ClaimVerification[];
};

export function buildEvidenceGraph({
  claims,
  evidence,
  verifications = [],
}: BuildEvidenceGraphInput): EvidenceGraph {
  const verificationByClaim = new Map(
    verifications.map((verification) => [verification.claimId, verification]),
  );
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  const nodes: EvidenceGraph["nodes"] = [
    ...claims.map((claim) => ({
      id: claim.id,
      type: "claim" as const,
      label: claim.text,
    })),
    ...evidence.map((item) => ({
      id: item.id,
      type: "evidence" as const,
      label: item.text,
    })),
  ];

  const sourceNodeIdBySourceId = new Map<string, string>();
  for (const item of evidence) {
    if (!sourceNodeIdBySourceId.has(item.sourceId)) {
      const sourceNodeId = `source-node-${item.sourceId}`;
      sourceNodeIdBySourceId.set(item.sourceId, sourceNodeId);
      nodes.push({
        id: sourceNodeId,
        type: "source",
        label: item.sourceName,
      });
    }
  }

  const edges: EvidenceGraph["edges"] = [];

  for (const claim of claims) {
    const verification = verificationByClaim.get(claim.id);
    const evidenceIds = verification?.evidenceIds ?? claim.evidenceIds;

    for (const evidenceId of evidenceIds) {
      const item = evidenceById.get(evidenceId);
      if (!item) continue;

      const type: EvidenceGraph["edges"][number]["type"] =
        item.relation === "QUALIFIES"
          ? "QUALIFIES"
          : item.relation === "CONTRADICTS"
            ? "CONTRADICTS"
            : item.relation === "DEFINES"
              ? "DEFINES"
              : "SUPPORTS";

      edges.push({
        id: `claim-evidence-${claim.id}-${evidenceId}`,
        from: item.id,
        to: claim.id,
        type,
      });
    }
  }

  for (const item of evidence) {
    edges.push({
      id: `evidence-source-${item.id}`,
      from: item.id,
      to: sourceNodeIdBySourceId.get(item.sourceId)!,
      type: "CITED_FROM",
    });
  }

  return evidenceGraphSchema.parse({ nodes, edges });
}
