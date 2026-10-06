# Canonical Mock Data

These fixtures are the shared development examples for RASHID.

They are used to let the GUI, API, Router, Retrieval, and database work proceed in parallel before all real modules are connected.

## Files

- `session.json`
- `chat-request.json`
- `router-output.json`
- `evidence-pack.json`
- `normal-answer.json`
- `clarification-answer.json`
- `disagreement-answer.json`
- `referral-answer.json`
- `no-evidence-answer.json`

## Critical rule

**Mocks are never production fallback religious content.**

If the real pipeline fails, production must return an error, clarification, abstention, insufficient-evidence state, or referral. It must never silently show one of these demo fixtures.
