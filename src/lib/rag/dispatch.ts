import type { RetrievalQuery } from "@/lib/schemas/retrieval";
import type { RetrievalConnector } from "@/lib/rag/types";

function hasAny(values: string[], needles: string[]): boolean {
  const normalized = values.map((value) => value.toLowerCase());
  return needles.some((needle) => normalized.some((value) => value.includes(needle)));
}

export function selectConnectors(
  query: RetrievalQuery,
  connectors: { local: RetrievalConnector; mcp: RetrievalConnector }
): RetrievalConnector[] {
  const needs = [...query.sourceTypes, query.route === "EXPLAIN" ? "explanation" : ""];
  const quran = hasAny(needs, ["quran", "qur", "قرآن"]);
  const hadith = hasAny(needs, ["hadith", "حديث"]);
  const terminology = hasAny(needs, ["terminology", "term", "مصطلح"]);
  const broad = ["LOOKUP", "EXPLAIN", "DISAGREEMENT"].includes(query.route);

  const selected: RetrievalConnector[] = [];
  if (quran || hadith || terminology || broad) selected.push(connectors.mcp);
  selected.push(connectors.local);

  return selected.filter((connector, index, all) =>
    all.findIndex((item) => item.name === connector.name) === index
  );
}
