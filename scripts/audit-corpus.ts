import fs from "node:fs";
import readline from "node:readline";

async function main() {
type JsonRecord = Record<string, any>;

const registryPath = "data/source-registry.json";
const normalizedPath = "data/normalized/dorar-hadith.jsonl";
const processedPath = "data/processed/dorar-hadith-chunks.jsonl";
const demoPath = "data/tests/demo-guarantee-set.json";
const inspectionPath = "data/tests/dorar-inspection.json";
const outputPath = "data/tests/corpus-audit.json";

function readJson(path: string): any {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

async function readJsonl(path: string) {
  const rows: JsonRecord[] = [];
  if (!fs.existsSync(path)) return rows;
  const rl = readline.createInterface({
    input: fs.createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of rl) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}

function counts(rows: JsonRecord[], field: string) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[field] ?? "unknown");
    out[value] = (out[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

const registry = readJson(registryPath) as JsonRecord[];
if (!fs.existsSync(normalizedPath) || !fs.existsSync(processedPath)) {
  throw new Error("Corpus build outputs are missing. Run build:corpus before audit:corpus.");
}
const normalized = await readJsonl(normalizedPath);
const chunks = await readJsonl(processedPath);
const inspection = fs.existsSync(inspectionPath) ? readJson(inspectionPath) : null;
const dorar = normalized.filter(row => row.sourceId === "dorar-hadith-local");

const gradingRows = dorar.map(row => ({ grading: row.metadata?.grading ?? "missing" }));
const dorarGrading = counts(gradingRows, "grading");

let demoCoverage: JsonRecord = { status: "not_configured", scenarios: 0, covered: 0, missing: [] };
if (fs.existsSync(demoPath)) {
  const demo = readJson(demoPath);
  const scenarios = Array.isArray(demo) ? demo : (demo.scenarios ?? []);
  const covered = scenarios.filter((scenario: JsonRecord) =>
    normalized.some((row: JsonRecord) =>
      row.sourceId === scenario.expectedSourceId &&
      row.metadata?.query === scenario.query
    )
  );
  demoCoverage = {
    status: "configured",
    basis: "exact normalized metadata.query + expectedSourceId presence",
    scenarios: scenarios.length,
    covered: covered.length,
    missing: scenarios
      .filter((scenario: JsonRecord) => !covered.includes(scenario))
      .map((scenario: JsonRecord) => scenario.id ?? "unknown")
  };
}

const audit = {
  generatedAt: new Date().toISOString(),
  corpusSize: { normalizedRecords: normalized.length, chunks: chunks.length },
  records: {
    bySourceType: counts(normalized, "sourceType"),
    bySourceId: counts(normalized, "sourceId"),
    byLanguage: counts(normalized, "language")
  },
  chunks: {
    bySourceType: counts(chunks, "sourceType"),
    bySourceId: counts(chunks, "sourceId"),
    byLanguage: counts(chunks, "language")
  },
  sources: {
    registryEntries: registry.length,
    registrySourceIds: registry.map(s => s.sourceId),
    observedSourceIds: [...new Set([...normalized, ...chunks].map(row => row.sourceId))]
  },
  dorar: {
    normalizedRecords: dorar.length,
    grading: dorarGrading,
    expectedFromRegistry: registry.find(s => s.sourceId === "dorar-hadith-local")?.recordCount ?? null,
    inspection
  },
  demoCoverage
};

fs.mkdirSync("data/tests", { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(audit, null, 2) + "\n");
console.log(JSON.stringify(audit, null, 2));

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
