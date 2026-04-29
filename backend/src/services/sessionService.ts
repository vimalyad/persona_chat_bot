import crypto from "crypto";
import { getDb } from "../db/database";
import { ChatMessage, Persona } from "../types";

export async function getOrCreateSession(persona: string) {
  const db = await getDb();

  let session = await db.get(
    "SELECT * FROM sessions WHERE persona = ? ORDER BY created_at DESC LIMIT 1",
    [persona],
  );

  if (!session) {
    const sessionId = generateId();
    await db.run("INSERT INTO sessions (id, persona) VALUES (?, ?)", [
      sessionId,
      persona,
    ]);
    session = { id: sessionId, persona };
  }

  const messages = await getSessionMessages(session.id);
  return { session, messages };
}

export async function resetSession(persona: string) {
  const db = await getDb();
  const sessionId = generateId();

  await db.run("INSERT INTO sessions (id, persona) VALUES (?, ?)", [
    sessionId,
    persona,
  ]);

  return { session: { id: sessionId, persona }, messages: [] };
}

export async function saveUserMessage(
  sessionId: string,
  content: string,
  shouldSave = true,
) {
  if (!shouldSave) return;
  await saveMessage(sessionId, "user", content);
}

export async function saveAssistantMessage(sessionId: string, content: string) {
  if (!content) return;
  await saveMessage(sessionId, "assistant", content);
}

export async function getMessageHistoryForResponse(sessionId: string) {
  const history = await getSessionMessages(sessionId);
  return history.slice(0, -1) as ChatMessage[];
}

async function getSessionMessages(sessionId: string) {
  const db = await getDb();
  return db.all("SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC", [
    sessionId,
  ]);
}

async function saveMessage(
  sessionId: string,
  role: ChatMessage["role"],
  content: string,
) {
  const db = await getDb();
  await db.run(
    "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
    [sessionId, role, content],
  );
}

function generateId() {
  return crypto.randomBytes(16).toString("hex");
}

