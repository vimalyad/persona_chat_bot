import { Router } from 'express';
import { getDb } from '../db/database';
import { generateChatResponse } from '../services/geminiService';
import { ChatMessage, Persona } from '../types';
import crypto from 'crypto';

const router = Router();

// Helper to generate simple ID
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

// Get the current session and chat history for a persona
router.get('/sessions/:persona', async (req, res) => {
  const { persona } = req.params;
  const db = await getDb();
  
  // Find latest session for this persona
  let session = await db.get('SELECT * FROM sessions WHERE persona = ? ORDER BY created_at DESC LIMIT 1', [persona]);
  
  if (!session) {
    const sessionId = generateId();
    await db.run('INSERT INTO sessions (id, persona) VALUES (?, ?)', [sessionId, persona]);
    session = { id: sessionId, persona };
  }

  const messages = await db.all('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC', [session.id]);
  
  res.json({ session, messages });
});

// Reset the conversation for a persona (creates a new session)
router.post('/sessions/:persona/reset', async (req, res) => {
  const { persona } = req.params;
  const db = await getDb();
  
  const sessionId = generateId();
  await db.run('INSERT INTO sessions (id, persona) VALUES (?, ?)', [sessionId, persona]);
  
  res.json({ session: { id: sessionId, persona }, messages: [] });
});

// Send a chat message
router.post('/chat', async (req, res) => {
  const { sessionId, persona, message } = req.body;
  if (!sessionId || !persona || !message) {
    return res.status(400).json({ error: 'Missing sessionId, persona, or message' });
  }

  const db = await getDb();
  
  try {
    // 1. Save user message to DB
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', message]);
    
    // 2. Fetch history for Gemini
    const history = await db.all('SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC', [sessionId]);
    
    // Since generateChatResponse expects history and the new message separated, 
    // we slice off the user message we just inserted.
    const messageHistory = history.slice(0, -1) as ChatMessage[];

    // 3. Get LLM response
    const aiResponse = await generateChatResponse(persona as Persona, messageHistory, message);
    
    // 4. Save LLM response to DB
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'assistant', aiResponse]);
    
    res.json({ response: aiResponse });
  } catch (error: any) {
    console.error('Error generating chat response:', error);
    res.status(500).json({ error: error.message || 'An error occurred during response generation' });
  }
});

export default router;
