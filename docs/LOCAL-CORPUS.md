# Track C — Local Curated Corpus

## Scope

This track owns the local curated corpus only. It complements live retrieval from approved APIs/MCP and approved-domain search; it is not a complete archive of the approved references.

## Current component

- **Dorar.net hadith subset:** 2,000 supplied JSONL records.
- Raw data must remain unchanged under `data/raw/dorar/`.
- Each hadith is kept as one semantic chunk.
- Dorar's supplied grading/attribution fields are preserved as metadata.
- No new authenticity judgment, paraphrase, or machine translation is added.
- Stable IDs are derived deterministically from the supplied original key.
- Provenance keeps the original JSONL line number and key.

## Planned MVP components

These are intentionally empty until an approved source payload/access is available:

- approved Islamic terminology
- introductory Islam/Da'wah material
- approved misconceptions / FAQs
- a small demo-topic guarantee set in `data/tests/demo-guarantee-set.json`, currently covered by the supplied Dorar subset

Do not fabricate local records for these categories.

## Commands

`npx tsx scripts/inspect-dorar.ts`

`npx tsx scripts/build-corpus.ts`

`npx tsx scripts/validate-corpus.ts`

`npx tsx scripts/audit-corpus.ts`

The audit writes `data/tests/corpus-audit.json` with corpus size, languages, source types, source IDs, Dorar grading distribution, inspection results, and exact-query demo-guarantee coverage.

## Safety

The local corpus is evidence data, not model-generated religious knowledge. Retrieval code must preserve source metadata and traceability. Final religious claims must still pass the project's evidence/claim gate.

## Integrated dev workflow

The original supplied JSONL and generated normalized/chunk files are tracked on
`dev`. The production local connector defaults to
`data/processed/dorar-hadith-chunks.jsonl`, exactly the build output path.
Empty placeholder raw files are ignored during input discovery. If more than one
nonempty JSONL exists, set DORAR_INPUT explicitly instead of guessing a source.

Run `npm run inspect:corpus`, `npm run build:corpus`, `npm run validate:corpus`,
`npm run audit:corpus`, and `npm run test:local-corpus`.
Validation compares all 2,000 original texts and supplied attribution/grading
fields to normalized records and chunks, with one-to-one coverage and unique IDs.
A failed build keeps previous generated outputs. Local retrieval tests use the
production default connector without MCP or Gemini.

The supplied dataset includes differing Dorar gradings, including weak reports.
Preserving supplied grading metadata does not certify every report as authentic.
Other planned corpus categories remain unpopulated; this repair does not invent
terminology, introductory or misconception source material.
