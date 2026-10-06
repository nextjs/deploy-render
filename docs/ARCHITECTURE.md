# RASHID Architecture

Evidence-Linked Dialogue Architecture:

User → Router → Retrieval → Evidence Pack → Atomic Claims → Claim-Evidence Gate → Dialogue Planner → Writer → Final Verification → Dialogue State update → Structured Response

Two persistent structures:
1. Dialogue State: where the discussion currently is.
2. Evidence Graph: why each claim is allowed and which source supports it.

## Final response pipeline (K → L → M)

Production chat runs Dialogue Planner, Evidence-Bound Writer and Final Verifier after
claim verification, before persisting the answer or updating dialogue state.
The writer receives only focused verified claims and evidence. Each structured
paragraph links claim IDs and evidence IDs. PARTIAL and CONFLICTED claims require
visible qualifications. Language and explanation-depth metadata, character caps,
focused IDs and paragraph evidence links are checked locally with Zod/invariants.
The verifier independently checks every paragraph's actual prose, qualifications,
language and planned move. Missing, duplicate or inconsistent verdicts fail closed.
A rejected answer is never persisted as a successful turn or used to update state.
No accepted claims yields insufficient_evidence. Existing clarification and referral
short circuits remain outside prose generation. Citations and saved evidence IDs
are limited to the evidence actually referenced in the verified final answer.

Tests: `npm run test:writer`, `npm run test:final-pipeline`, `npm run test:chat-api`.
In runtimes that block tsx CLI IPC, use `node --import tsx scripts/<test-file>.ts`.
Tests use injected model clients and do not require provider or database credentials.
Semantic checks depend on the verifier model; passing them is not a scholarly audit.
No live model validation is claimed by the offline tests.
