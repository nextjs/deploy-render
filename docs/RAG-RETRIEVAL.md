# Track F — Hybrid Retrieval

## Scope
Track F owns RetrievalQuery → controlled source selection → retrieval → normalization → deduplication → ranking → EvidenceCandidate[] → EvidencePack construction. It does not implement answer writing, personal-fatwa reasoning, GUI changes, or Track C ingestion.

## Architecture
`RetrievalQuery` → dispatcher → approved live connectors + local ChunkRecord connector → normalize → deduplicate → rank → Top-K `EvidenceCandidate[]` → `EvidencePack`.

The local connector consumes the frozen `ChunkRecord` contract and uses `RASHID_LOCAL_CORPUS_PATH` when Track C supplies processed JSONL.

## Official interface input matrix

| Source | Content | Transport | Exact operation | Required inputs | Optional inputs | Language | Filters | Returned fields | Stable ID | Locator | Auth | Limits | MVP mapping |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Islamic Content MCP | Quran, hadith, IslamHouse library | Streamable HTTP | `tools/list` then `tools/call` → documented `search` | Discovered from advertised `inputSchema`; no undocumented params are guessed | Language/limit only if advertised | Sent only if schema advertises a language field | Source/type filtering after normalization | Structured content or text content; candidate accepted only with identifiable source/locator | Adapter hash when needed | Public URL or locator | None documented | Reasonable rate limits; no numeric limit published | **Implemented** |
| QuranEnc | Quran translations | HTTPS REST | `GET /api/v1/translation/aya/{translation_key}/{sura_number}/{aya_number}` | translation key, surah, ayah | localization for translation list | Translation language key | Exact verse | sura, aya, translation, footnotes | translation key + sura + aya | API path | None stated | Not documented | Deferred: MCP exposes Quran retrieval |
| HadeethEnc | Hadith, explanation, grading | HTTPS/API | Developers API (exact endpoint not exposed by inspected public page) | Must be confirmed from developer docs before coding | Must be confirmed | Multilingual | Hadith/category | Exact API response schema not verified | Source ID when known | Source page | Not established | Not documented | Deferred: MCP + Track C |
| IslamHouse | Books/articles/audio/video | HTTPS REST API | Developer portal | API key after registration | API-specific | Multilingual | Library/content | JSON content | API ID | Original material URL | App key | 5,000/hour documented by portal | Deferred: MCP library tools |
| Bayan Al-Islam | Da'wah/introductory content | HTTPS REST | Swagger GET endpoints such as `/en/Api/content/muslims/list`, `/en/Api/id/{id}` | Endpoint-specific | Endpoint-specific | Language-specific paths | Endpoint-specific | JSON responses | API ID | API/content URL | Not established | Not documented | Deferred: MCP broad search |

### Official sources inspected
- Islamic Content MCP: https://mcp.islamiccontent.org/ and `https://mcp.islamiccontent.org/mcp`
- QuranEnc API: https://quranenc.com/ar/home/api/
- HadeethEnc: https://hadeethenc.com/ar/
- IslamHouse developer docs: https://api2.islamhouse.com/ar/docs/
- Bayan Al-Islam Swagger: https://abha.byenah.com/swagger/index.html

The Islamic Content MCP page currently documents 11 read-only tools: `search`, `fetch`, `list_languages`, `get_quran_verses`, `list_quran_translations`, `get_quran_audio`, `get_hadith`, `browse_hadith_categories`, `browse_library`, `get_library_item`, and `list_library_categories`. It also states that results carry public source links and no authentication is required.

### MCP argument safety
The official MCP page names the `search` tool but does not publish its argument JSON schema on the page. Track F therefore calls `tools/list` first and reads the live `inputSchema`. It sends a query field only when the server advertises one, plus language/limit only when those exact fields are advertised. If required fields cannot be satisfied without guessing, retrieval fails safely.

## Source dispatch
- Quran need/source type → MCP.
- Hadith need/source type → MCP + local.
- Terminology need/source type → MCP + local.
- Broad LOOKUP/EXPLAIN/DISAGREEMENT → MCP + local.
- Local is always included as the replaceable Track C cache.
No LLM or arbitrary URL chooses a source.

## Normalization/provenance
Every accepted result is validated with `evidenceCandidateSchema`. Live MCP records get deterministic adapter IDs if the source does not expose stable IDs. A result is rejected unless text and a source locator are identifiable. Hadith grading, when supplied by the source, is preserved in the locator because the frozen EvidenceCandidate contract has no dedicated grading field; the value is not interpreted or changed.

## Deduplication/ranking
Deduplication key: `sourceId | locator | normalized text`. Better provenance wins; ties use score.

Ranking:
`0.60 * connector score + 0.20 * lexical score + source-type boost + language boost + provenance boost`.

This is intentionally transparent; no vector database or opaque reranker is used.

## Failure behavior
Connectors run with `Promise.allSettled`; a failing connector cannot fabricate or block valid results from another approved connector. Malformed external results are rejected by Zod. Empty results stay empty.

## Testing
`npm run test:retrieval` uses `data/mock/retrieval-chunks.json`, explicitly **TEST FIXTURE ONLY**, and disables live MCP for deterministic tests. It covers terminology, Quran, hadith, explanatory, multilingual, and no-evidence queries and validates EvidencePack construction. The expected retrieval cases are also recorded in `data/tests/retrieval-questions.json`. `npm run test:retrieval-hitk` records Retrieval Hit@5 against those expected cases as a diagnostic metric.

A live MCP smoke test is implemented in `scripts/test-mcp.ts` and has been verified from a developer machine against the official endpoint. The test confirms the documented `search` tool is callable and that returned evidence preserves text plus a source locator. `scripts/test-hybrid-retrieval.ts` also verifies dispatcher selection, deduplication, ranking, MCP failure fallback, and EvidencePack provenance.

## Track C
When Track C supplies real ChunkRecord JSONL, set `RASHID_LOCAL_CORPUS_PATH` to that processed file. The retrieval architecture does not change.
