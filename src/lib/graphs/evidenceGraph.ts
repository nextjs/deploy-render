import type { EvidenceGraph } from "@/lib/schemas/graph";

export function createEmptyEvidenceGraph(): EvidenceGraph {
  return { nodes: [], edges: [] };
}
