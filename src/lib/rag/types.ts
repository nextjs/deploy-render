import type { ChunkRecord } from "@/lib/schemas/corpus";
import type { EvidenceCandidate, RetrievalQuery } from "@/lib/schemas/retrieval";

export interface RetrievalConnector {
  readonly name: string;
  search(query: RetrievalQuery): Promise<EvidenceCandidate[]>;
}

export interface LocalConnectorOptions {
  path?: string;
  chunks?: ChunkRecord[];
}

export interface RetrievalDiagnostics {
  query: string;
  queryLanguage: string;
  selectedConnectors: string[];
  resultsByConnector: Record<string, number>;
  deduplicatedCount: number;
  finalCount: number;
}

export interface RetrievalResult {
  candidates: EvidenceCandidate[];
  diagnostics: RetrievalDiagnostics;
}

export interface RetrievalOptions {
  connectors?: RetrievalConnector[];
  localConnector?: RetrievalConnector;
  enableMcp?: boolean;
}
