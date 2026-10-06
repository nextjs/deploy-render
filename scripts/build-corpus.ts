import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline";
import path from "node:path";
import { resolveDorarInput } from "./dorar-input";
import { baseSourceRecordSchema, chunkRecordSchema } from "../src/lib/schemas/corpus";

async function main() {
const rawPath = resolveDorarInput();
const normalizedPath = "data/normalized/dorar-hadith.jsonl";
const processedPath = "data/processed/dorar-hadith-chunks.jsonl";
const inspectionPath = "data/tests/dorar-inspection.json";
const errorPath = "data/tests/error-report.json";

const missing = new Map<string, number>();
const keyCounts = new Map<string, number>();
const sourceBooks = new Map<string, number>();
const gradings = new Map<string, number>();
const queries = new Map<string, number>();
const errors: Array<{line:number; reason:string}> = [];

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}
function stableId(prefix: string, value: string) {
  return `${prefix}-${crypto.createHash("sha256").update(value, "utf8").digest("hex").slice(0, 24)}`;
}

if (!rawPath) {
  throw new Error("No Dorar JSONL found in data/raw/dorar. Set DORAR_INPUT or add a .jsonl file.");
}
if (!fs.existsSync(rawPath)) {
  throw new Error(`Raw Dorar dataset not found at ${rawPath}.`);
}
for (const file of [normalizedPath, processedPath, inspectionPath, errorPath]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

const normalizedStream = fs.createWriteStream(normalizedPath + ".tmp", { encoding: "utf8" });
const chunkStream = fs.createWriteStream(processedPath + ".tmp", { encoding: "utf8" });
const rl = readline.createInterface({
  input: fs.createReadStream(rawPath, { encoding: "utf8" }),
  crlfDelay: Infinity
});

let total = 0, normalizedCount = 0, chunkCount = 0;

for await (const line of rl) {
  if (!line.trim()) continue;
  total++;
  try {
    const row = JSON.parse(line) as Record<string, unknown>;
    if (!row || Array.isArray(row)) throw new Error("record is not an object");

    for (const field of ["source","query","text","narrator","muhaddith","source_book","reference","grading","key"]) {
      if (row[field] == null || row[field] === "") bump(missing, field);
    }
    if (row.key == null || row.text == null || String(row.text).trim() === "") {
      throw new Error("missing key or text");
    }

    const originalKey = String(row.key);
    if (keyCounts.has(originalKey)) throw new Error(`duplicate Dorar key: ${originalKey}`);
    bump(keyCounts, originalKey);
    if (row.source_book) bump(sourceBooks, String(row.source_book));
    if (row.grading) bump(gradings, String(row.grading));
    if (row.query) bump(queries, String(row.query));

    const record = baseSourceRecordSchema.parse({
      recordId: stableId("hadith-dorar", originalKey),
      sourceId: "dorar-hadith-local",
      sourceType: "hadith",
      title: null,
      text: String(row.text),
      language: "ar",
      locator: `${String(row.source_book ?? "dorar")}:${String(row.reference ?? "unknown")}`,
      url: "https://dorar.net/hadith",
      conceptIds: [],
      metadata: {
        sourceName: "Dorar.net hadith subset",
        source: row.source,
        originalKey,
        query: row.query,
        narrator: row.narrator,
        muhaddith: row.muhaddith,
        sourceBook: row.source_book,
        reference: row.reference,
        grading: row.grading,
        provenance: { type: "supplied_jsonl", sourceUrl: "https://dorar.net", rawLine: total }
      }
    });

    normalizedStream.write(JSON.stringify(record) + "\n");
    normalizedCount++;

    const chunk = chunkRecordSchema.parse({
      chunkId: stableId("chunk", `${record.recordId}:0`),
      recordId: record.recordId,
      sourceId: record.sourceId,
      sourceType: record.sourceType,
      text: record.text,
      language: record.language,
      locator: record.locator,
      url: record.url,
      conceptIds: record.conceptIds,
      chunkIndex: 0,
      metadata: record.metadata
    });

    chunkStream.write(JSON.stringify(chunk) + "\n");
    chunkCount++;
  } catch (error) {
    errors.push({ line: total, reason: error instanceof Error ? error.message : String(error) });
  }
}

await new Promise<void>((resolve, reject) => {
  normalizedStream.end(resolve);
  normalizedStream.on("error", reject);
});
await new Promise<void>((resolve, reject) => {
  chunkStream.end(resolve);
  chunkStream.on("error", reject);
});

const duplicates = [...keyCounts.entries()].filter(([, count]) => count > 1);

fs.writeFileSync(inspectionPath, JSON.stringify({
  input: rawPath,
  totalRecords: total,
  normalizedRecords: normalizedCount,
  generatedChunks: chunkCount,
  rejectedRecords: errors.length,
  missingFieldCounts: Object.fromEntries(missing),
  duplicateKeys: duplicates,
  encoding: "UTF-8"
}, null, 2));

fs.writeFileSync(errorPath, JSON.stringify(errors, null, 2));
console.log(JSON.stringify({ totalRecords: total, normalizedRecords: normalizedCount, generatedChunks: chunkCount, rejectedRecords: errors.length }, null, 2));
if (!total || errors.length) {
  fs.rmSync(normalizedPath + ".tmp", { force: true });
  fs.rmSync(processedPath + ".tmp", { force: true });
  throw new Error("Corpus build failed: empty input or rejected records. Previous outputs were preserved.");
}
fs.renameSync(normalizedPath + ".tmp", normalizedPath);
fs.renameSync(processedPath + ".tmp", processedPath);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
