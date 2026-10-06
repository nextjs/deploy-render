# RASHID Contracts v1

Status: **Application Contracts v1 frozen for parallel development.**

## Contract groups

### Session / user
- UserProfile
- Session
- Conversation
- ConversationTurn

### Routing
- RouterInput
- RouterOutput

### RAG / retrieval
- BaseSourceRecord
- ChunkRecord
- RetrievalQuery
- EvidenceCandidate
- EvidenceItem
- EvidencePack

Only the **base corpus contract** is frozen. Source-specific Qur'an, Hadith, Tafsir, misconception, and terminology schemas remain pending data review.

### Claims / verification
- AtomicClaim
- ClaimVerification

### Dialogue
- DialoguePoint
- DialogueState
- DialoguePlan
- DisagreementState
- ReferralState

### Graph / UI
- EvidenceGraph
- DiscussionMap

### API
- ChatRequest
- StructuredResponse

## Mock policy

Canonical mocks live in `data/mock/`.

Mocks are for development and testing only. They must never be used as production fallback religious content.

If the real pipeline cannot produce a supported answer, the production fallback is an error, abstention, clarification, or referral state.

## Compatibility rule

After this freeze, changing a shared contract requires updating:
1. the Zod schema,
2. canonical mocks,
3. all consuming modules,
4. the Notion contracts reference,
5. the Pull Request description.

Do not silently rename or remove fields used by another module.

## Multilingual contract amendment v1.1

UI language is separate from content language.

- `uiLanguage`: currently `ar | en`.
- `preferredResponseLanguage`: BCP-47-style language tag.
- corpus `language`: BCP-47-style language tag.
- Retrieval separates `queryLanguage`, `preferredResponseLanguage`, and `preferredSourceLanguages`.

This amendment preserves the existing architecture while allowing multilingual questions and approved multilingual sources.
