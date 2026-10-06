# Local live pipeline test

Work directly on `dev`. Pull the latest commit, install with `npm ci`, then load
`.env.local` with GEMINI_API_KEY and DATABASE_URL. LLM_MODELS is optional; keep
known working model names. Never commit credentials or paste them into test reports.
Node 20.6+ is required for --env-file (a supported current Node LTS is preferred).

```sh
npm run test:pipeline:live -- --check
npm run test:db
npm run test:mcp
npm run test:pipeline:live -- --question "لماذا يصوم المسلمون في رمضان؟"
npm run test:pipeline:live
```

The live script creates real test sessions/conversations and invokes the same
production chat service used by `/api/chat`. It uses the configured database,
real retrieval connectors and Gemini. It does not start a web server or test the
HTTP route/browser UI. It logs router input/output, retrieval candidates and
connector diagnostics, claims/verifications, K planner, L writer, M verifier,
final response, dialogue state and database round-trip checks. It does not use
fake model answers or insert synthetic religious evidence.

The default suite covers Arabic explanation, follow-up within one conversation,
English brief answer, disagreement, clarification and personal-ruling referral.
A normal answer must actually reach K/L/M. An insufficient-evidence result is
safe but FAILS the normal-answer test: it does not prove the writer/verifier ran.
Clarification and referral deliberately skip K/L/M. Missing evidence and rejected
prose are additionally checked in deterministic tests below.

```sh
npm run validate:mocks
npm run test:retrieval
npm run test:hybrid-retrieval
npm run test:claims
npm run test:evidence-gate
npm run test:planner
npm run test:writer
npm run test:final-pipeline
npm run test:chat-api
npx tsc --noEmit
npm run build
```

These unit/integration tests use controlled fixtures or injected clients; they
cannot prove provider, database or real-source connectivity. `test:router`,
`test:dialogue`, `test:db` and `test:mcp` provide separate live checks.

`RASHID_LOCAL_CORPUS_PATH` selects a real approved chunk file. The default path is
`data/processed/dorar-hadith-chunks.jsonl`. The tracked default file contains 2,000 Dorar hadith chunks.
Run `npm run validate:corpus` and `npm run test:local-corpus` to check local data.
Keep MCP enabled (`RASHID_DISABLE_MCP` unset or false) for complementary live retrieval,
or use your existing approved corpus path. Do not select data/mock files as
religious evidence. A run relying on MCP does not validate local corpus ingestion.
A connector can fail while another succeeds: inspect resultsByConnector rather
than treating an answer alone as proof both sources work.

Test data remains in the configured database. Use the printed session and
conversation IDs to identify it. There is no automatic cleanup.

A pass checks structure, stage execution and persistence. Manually review actual
language, depth, source URLs/locators, claim support, quotations, qualifications
and disagreement. Model-based verification can still miss mistakes.

On failure, read the lastStage and preceding trace. `router:start` suggests a
model/config failure; `retrieval:result` with zero candidates suggests a source or
query issue; `claim-gate:start` points to claim generation/gate; `K/L/M:start`
identifies the failing final stage. Service errors may be generic; the preceding
console error carries the internal cause. Share traces without .env.local values.

To test HTTP separately, run `npm run dev`, create a session via POST
`/api/sessions` with `{userProfile: ...}`, create a conversation via POST
`/api/conversations` with `{sessionId: ...}`, then POST `/api/chat` with
`{sessionId, conversationId, message}`. The live script already checks the
service behind this endpoint, including database persistence.

## Readable saved results

Every run automatically saves `test-results/pipeline-live.html` (open in Chrome
or Edge) and `test-results/pipeline-live.json`. The HTML uses UTF-8, RTL layout
and independent text directions for Arabic/English. It shows each question,
final answer, expected/actual status, failures, sources and expandable stage data.
Reports update during the run so completed stages remain available after a failure.
The next run replaces these files; copy them elsewhere to retain previous runs.
Reports are ignored by git. Configured Gemini/database secrets and ANSI color
codes are removed from saved trace values. Avoid sharing private questions.
Use `--report-dir another-folder` to change the output directory, and `--verbose`
to restore complete console traces. These flags follow `npm run test:pipeline:live --`.
