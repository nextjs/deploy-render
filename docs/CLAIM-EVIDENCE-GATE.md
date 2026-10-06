# Track H — Claim Builder + Claim-Evidence Gate

## Purpose

Track H prevents RASHID from allowing religious factual claims to continue merely because an LLM knows or believes them.

The module sits after Retrieval/Evidence Pack preparation:

User Question
→ Router
→ Retrieval
→ Evidence Pack
→ candidate content / answer plan
→ Claim Builder
→ Claim-Evidence Gate
→ verified claims
→ later Writer / StructuredResponse

Track H does not retrieve evidence and does not write the final answer.

## Claim Builder

Location: `src/lib/ai/claimBuilder.ts`

Input:
- candidate text;
- optional question/context;
- a caller-supplied evidence ID scope.

Output:
- existing `AtomicClaim[]` contract.

The builder extracts small, independently verifiable propositions. It preserves the supplied evidence scope because the frozen `AtomicClaim` contract requires non-empty `evidenceIds`. It does not decide whether those evidence items support the claim.

Claims are request-local and use predictable IDs such as `claim-1`.

Candidate text is untrusted data. Prompt-injection text inside candidate content is never treated as policy.

## Claim-Evidence Gate

Location: `src/lib/ai/claimEvidenceGate.ts`

Input:
- `AtomicClaim[]`;
- `EvidencePack`.

Output:
- existing `ClaimVerification[]`.

Allowed statuses are the frozen contract values:
- `SUPPORTED`
- `PARTIAL`
- `CONFLICTED`
- `UNSUPPORTED`

The Gate evaluates only the supplied EvidencePack. Model memory is never evidence.

### Status rules

- **SUPPORTED:** supplied evidence directly supports the actual proposition.
- **PARTIAL:** evidence supports only part of the claim or a weaker version.
- **CONFLICTED:** supplied approved evidence meaningfully conflicts about the proposition.
- **UNSUPPORTED:** the EvidencePack does not sufficiently support the claim.

UNSUPPORTED is a normal safe outcome.

## Programmatic invariants

After structured LLM output:
- Zod validates the contract.
- Every verification must reference a real claim.
- Every referenced evidence ID must exist in the EvidencePack.
- There is exactly one verification per claim.
- Duplicate claim IDs in a verification response are rejected.
- Non-UNSUPPORTED statuses require at least one real evidence ID.
- Empty claim text is rejected by the frozen AtomicClaim schema.
- No unvalidated object passes through.

An empty EvidencePack deterministically produces UNSUPPORTED for every claim.

## Multilingual behavior

The modules do not force English translation. Arabic, English, French, and other content languages are preserved where practical.

## Hadith grading

The frozen `EvidenceItem` contract does not expose a dedicated grading field. The Gate therefore does not invent grading metadata. If grading/weakness is represented in available evidence provenance or text, the Gate prompt instructs the model not to strengthen it.

## LLM client and structured output

Track H reuses `getLlmClient()` from `src/lib/ai/client.ts`.

Both modules request:
- `responseMimeType: application/json`
- a JSON schema;
- temperature 0.

The result is parsed, validated with Zod, then checked with deterministic invariants.

No Gemini model name is hardcoded in Track H.

## Failure behavior

- Claim Builder failure is a technical failure; it does not invent claims.
- Gate schema/invariant failure is a technical failure; it does not mark claims supported.
- Empty EvidencePack is a safe UNSUPPORTED result.
- A normal UNSUPPORTED verification does not throw.

## Testing

Run:

`npm run test:claims`
`npm run test:evidence-gate`
`npm run test:router`
`npm run validate:mocks`
`npm run build`

Tests use injected fake LLM clients for deterministic module behavior. This avoids measuring LLM quality as a unit test while still testing structured-output handling, extraction invariants, evidence IDs, statuses, multilingual inputs, and prompt-injection boundaries.

## Future integration

When Track F is available, the intended flow is:

```ts
const candidates = await retrieveEvidence(query);
const evidencePack = buildEvidencePack(query, candidates);
const claims = await buildClaims(candidateText, {
  evidenceIds: evidencePack.evidence.map((item) => item.id),
});
const verification = await verifyClaims({ claims, evidencePack });
```

No retrieval implementation is copied into Track H.

Later Writer behavior can use the verification status:
- SUPPORTED → may state with evidence;
- PARTIAL → qualify/weaken or retrieve more evidence;
- CONFLICTED → present disagreement carefully;
- UNSUPPORTED → remove, abstain, or retrieve more evidence.
