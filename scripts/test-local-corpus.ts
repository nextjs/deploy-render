import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveDorarInput } from "./dorar-input";
import { LocalCorpusConnector } from "../src/lib/rag/connectors/local";
import { chunkRecordSchema } from "../src/lib/schemas/corpus";
async function main() {
  assert.ok(fs.statSync(resolveDorarInput()).size > 0);
  const file = process.env.RASHID_LOCAL_CORPUS_PATH ?? "data/processed/dorar-hadith-chunks.jsonl";
  const chunks = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => chunkRecordSchema.parse(JSON.parse(line)));
  assert.equal(chunks.length, 2000);
  const connector = new LocalCorpusConnector();
  for (const sample of [chunks[0], chunks[Math.floor(chunks.length / 2)], chunks[chunks.length - 1]]) {
    const found = await connector.search({
      query: sample.text, route: "LOOKUP", contentLevel: "A", queryLanguage: "ar",
      preferredResponseLanguage: "ar", preferredSourceLanguages: ["ar"],
      conceptIds: [], sourceTypes: ["hadith"], topK: 8,
    });
    const match = found.find(item => item.chunkId === sample.chunkId);
    assert.ok(match, `Default local connector did not retrieve ${sample.chunkId}`);
    assert.equal(match.text, sample.text);
    assert.equal(match.recordId, sample.recordId);
    assert.equal(match.locator, `${sample.locator} | grading=${sample.metadata.grading}`);
  }
  console.log("Local corpus: 2000 valid chunks; default connector retrieves first/middle/last samples with preserved provenance.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
