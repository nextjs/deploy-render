# Session Database

RASHID uses a session-based model for the MVP, without authentication.

Planned storage: Neon PostgreSQL.

Core entities:
- sessions
- conversations
- conversation_turns
- dialogue_states

The database stores session and conversation data. The approved religious RAG corpus remains separate.

Implementation follows after the Session schemas and database access method are finalized.
