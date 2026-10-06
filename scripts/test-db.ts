import { createSession, getSession, updateSessionProfile } from "../src/lib/db/sessions";
import { createConversation } from "../src/lib/db/conversations";
import { saveConversationTurn, listConversationTurns } from "../src/lib/db/turns";
import { saveDialogueState, getDialogueState } from "../src/lib/db/dialogueStates";
import { createEmptyDialogueState } from "../src/lib/graphs/dialogueState";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Load .env.local before running this script.");
  }

  const profile = {
    uiLanguage: "ar" as const,
    preferredResponseLanguage: "ar",
    religiousBackground: "prefer_not_to_say" as const,
    goal: "learn_about_islam" as const,
    explanationDepth: "balanced" as const,
    interests: ["demo"],
  };

  console.log("1. Creating session...");
  const session = await createSession(profile);
  console.log("   session:", session.id);

  console.log("2. Reading session...");
  const loadedSession = await getSession(session.id);
  if (!loadedSession) throw new Error("Session was not found after creation.");

  console.log("3. Updating session profile...");
  await updateSessionProfile(session.id, { ...profile, interests: ["demo", "updated"] });

  console.log("4. Creating conversation...");
  const conversation = await createConversation({
    sessionId: session.id,
    title: "Database smoke test",
    primaryTopic: "demo",
  });
  console.log("   conversation:", conversation.id);

  console.log("5. Saving turns...");
  await saveConversationTurn({
    conversationId: conversation.id,
    role: "user",
    content: "Test user message",
  });
  await saveConversationTurn({
    conversationId: conversation.id,
    role: "assistant",
    content: "Test assistant message",
  });

  console.log("6. Reading turns...");
  const turns = await listConversationTurns(conversation.id);
  if (turns.length !== 2) throw new Error(`Expected 2 turns, received ${turns.length}.`);

  console.log("7. Saving dialogue state...");
  const state = {
    ...createEmptyDialogueState(),
    mainTopic: "demo",
  };
  await saveDialogueState(conversation.id, state);

  console.log("8. Reading dialogue state...");
  const loadedState = await getDialogueState(conversation.id);
  if (!loadedState || loadedState.mainTopic !== "demo") {
    throw new Error("Dialogue state round trip failed.");
  }

  console.log("\n✓ Database smoke test passed.");
  console.log("Created test data remains in Neon and can be deleted later.");
}

main().catch((error) => {
  console.error("\n✗ Database smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
