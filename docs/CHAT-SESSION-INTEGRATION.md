# Chat API + Session Integration (Track J)

Track J owns the server-side lifecycle for `POST /api/chat`. It composes existing session, conversation, Router, Retrieval, Dialogue, and response contracts without creating replacement implementations.

## Request contract

`chatRequestSchema` remains unchanged and is validated before orchestration. The frozen v1.1 contract currently requires:

- `sessionId`
- `conversationId`
- `message`

The stored session profile is authoritative. An optional browser-supplied `userProfile` is accepted by the frozen request schema for compatibility but is not used when a stored session exists.

Because the request contract requires `conversationId`, a new conversation is created through the existing `POST /api/conversations` lifecycle before the first `POST /api/chat` call. J does not alter Contracts v1.1 to make the ID optional.

## Lifecycle

1. Validate request with `chatRequestSchema`.
2. Load session with `getSession`; reject unknown sessions.
3. Load conversation with `getConversation`; reject missing conversations.
4. Enforce `conversation.sessionId === session.id`.
5. Load previous DialogueState, or use the empty state.
6. Save the user turn.
7. Run existing `routeQuestion()` with the stored UserProfile and previous DialogueState.
8. Short-circuit CLARIFY and REFERRAL without Retrieval.
9. For evidence routes, build the existing RetrievalQuery, call `retrieveEvidence()`, then `buildEvidencePack()`.
10. If the EvidencePack is empty, return `insufficient_evidence` safely.
11. Run the real Track H Claim Builder + Claim-Evidence Gate on evidence routes through the injectable `claimGate` dependency; production wiring supplies the real H implementation.
12. Build the existing DiscussionMap/EvidenceGraph through Track I modules.
13. Update and persist DialogueState through `updateDialogueState()` and `saveDialogueState()`.
14. Save the assistant turn corresponding to the returned message.
15. Validate the final object with `structuredResponseSchema`.

## H integration boundary

Track H is now available on `dev`. J does not copy or redesign H. `ChatPipelineDependencies.claimGate` remains injectable for deterministic tests, while `defaultChatDependencies` supplies the real `buildClaims()` + `verifyClaims()` implementation:

```ts
// Production adapter
claimGate: {
  run: async (candidateText, evidencePack) => {
    const claims = await buildClaims(candidateText, {
      question: evidencePack.question,
      evidenceIds: evidencePack.evidence.map((item) => item.id),
    });
    const verifications = await verifyClaims({ claims, evidencePack });
    return { claims, verifications };
  },
}

// Injectable boundary

type ClaimGateDependency = {
  run: (candidateText: string, evidencePack: EvidencePack) => Promise<{
    claims: AtomicClaim[];
    verifications: ClaimVerification[];
  }>;
};
```

When H is available, the dependency can call `buildClaims()` and `verifyClaims()` directly. There are no production fake claims in J.

## Pipeline architecture

`routeQuestion()` (Track E) → `retrieveEvidence()` / `buildEvidencePack()` (Track F) → `buildClaims()` / `verifyClaims()` (Track H) → `updateDialogueState()` / `buildDiscussionMap()` / `buildEvidenceGraph()` (Track I) → J persistence + `StructuredResponse` API assembly. A final Writer is intentionally not implemented in J.

## I integration

J directly reuses:

- `updateDialogueState()`
- `buildDiscussionMap()`
- `buildEvidenceGraph()`
- `saveDialogueState()`
- `getDialogueState()`

Dialogue state is therefore loaded before each turn and persisted after successful orchestration.

## Writer limitation

A final Writer module is not implemented yet. J intentionally does not create a new Writer architecture. For an evidence route, the API returns the actual evidence/citations and a safe integration-boundary message. The future Writer supplies final prose without changing the session lifecycle.

## Failure behavior

- malformed request -> 400
- unknown session -> 404
- missing conversation -> 404
- conversation owned by another session -> 403
- CLARIFY -> `clarification_required`
- REFERRAL/personal ruling -> `referral`
- no approved evidence -> `insufficient_evidence`
- unexpected server failure -> 500 with a generic client-safe message

After a user turn has been saved, an unexpected pipeline failure also attempts to save one assistant error turn so the stored conversation reflects what the API returned.

## Security

All DB and LLM dependencies are server-side imports. No `DATABASE_URL`, `GEMINI_API_KEY`, prompts, or secrets are returned to the browser. Development logs contain only operational identifiers and pipeline status.

## Testing

`npm run test:chat-api` covers request validation, session lookup, conversation ownership, new/existing conversation continuity, stored-profile authority, CLARIFY, REFERRAL, insufficient evidence, H boundary, StructuredResponse validation, state persistence, turn persistence, and safe technical failures.

## Frontend-only remaining work

The frontend still needs to use the existing session and chat HTTP boundaries:

- `POST /api/sessions` to obtain `sessionId`
- `POST /api/conversations` to obtain `conversationId` for a new conversation
- `POST /api/chat` for turns and returned state

No frontend component is changed by Track J.
