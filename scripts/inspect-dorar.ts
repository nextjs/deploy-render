import fs from "node:fs";
import { resolveDorarInput } from "./dorar-input";

const input = resolveDorarInput(process.argv[2] ?? process.env.DORAR_INPUT);
const required = ["source","query","text","narrator","muhaddith","source_book","reference","grading","key"];

const missing = new Map<string, number>();
const keyCounts = new Map<string, number>();
const sourceBooks = new Map<string, number>();
const gradings = new Map<string, number>();
const queries = new Map<string, number>();

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

if (!input) throw new Error("No Dorar JSONL found in data/raw/dorar.");
if (!fs.existsSync(input)) throw new Error("Input not found: " + input);

const lines = fs.readFileSync(input, "utf8").split(/\r?\n/);
let total = 0;
let malformed = 0;

for (const line of lines) {
  if (!line.trim()) continue;
  total++;
  try {
    const row = JSON.parse(line) as Record<string, unknown>;
    if (!row || Array.isArray(row)) throw new Error("record is not an object");

    for (const field of required) {
      if (row[field] == null || row[field] === "") bump(missing, field);
    }
    if (row.key != null) bump(keyCounts, String(row.key));
    if (row.source_book) bump(sourceBooks, String(row.source_book));
    if (row.grading) bump(gradings, String(row.grading));
    if (row.query) bump(queries, String(row.query));
  } catch {
    malformed++;
  }
}

const duplicates = [...keyCounts.entries()].filter(([, count]) => count > 1);

console.log(JSON.stringify({
  input,
  totalRecords: total,
  missingFieldCounts: Object.fromEntries(missing),
  duplicateKeys: duplicates.length,
  duplicateKeySamples: duplicates.slice(0, 20),
  malformedRecords: malformed,
  sourceBooks: Object.fromEntries([...sourceBooks.entries()].sort((a,b) => b[1]-a[1])),
  gradingValues: Object.fromEntries([...gradings.entries()].sort((a,b) => b[1]-a[1])),
  queryDistribution: Object.fromEntries([...queries.entries()].sort((a,b) => b[1]-a[1])),
  encoding: "UTF-8"
}, null, 2));

if (!total || malformed || missing.size || duplicates.length) process.exitCode = 1;
