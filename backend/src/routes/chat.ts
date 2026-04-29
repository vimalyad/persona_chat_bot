import { Router } from 'express';
import { getDb } from '../db/database';
import { streamChatResponse } from '../services/geminiService';
import { ChatMessage, Persona } from '../types';
import crypto from 'crypto';

const router = Router();

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

router.get('/sessions/:persona', async (req, res) => {
  const { persona } = req.params;
  const db = await getDb();
  
  let session = await db.get('SELECT * FROM sessions WHERE persona = ? ORDER BY created_at DESC LIMIT 1', [persona]);
  
  if (!session) {
    const sessionId = generateId();
    await db.run('INSERT INTO sessions (id, persona) VALUES (?, ?)', [sessionId, persona]);
    session = { id: sessionId, persona };
  }

  const messages = await db.all('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC', [session.id]);
  
  res.json({ session, messages });
});

router.post('/sessions/:persona/reset', async (req, res) => {
  const { persona } = req.params;
  const db = await getDb();
  
  const sessionId = generateId();
  await db.run('INSERT INTO sessions (id, persona) VALUES (?, ?)', [sessionId, persona]);
  
  res.json({ session: { id: sessionId, persona }, messages: [] });
});

router.post('/chat', async (req, res) => {
  const { sessionId, persona, message } = req.body;
  if (!sessionId || !persona || !message) {
    return res.status(400).json({ error: 'Missing sessionId, persona, or message' });
  }

  const db = await getDb();
  
  try {
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', message]);
    
    const history = await db.all('SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC', [sessionId]);
    const messageHistory = history.slice(0, -1) as ChatMessage[];

    // Stream the response via SSE — returns the full cleaned text when done
    const fullResponse = await streamChatResponse(persona as Persona, messageHistory, message, res);
    
    // Save the complete assistant response to DB after streaming finishes
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'assistant', fullResponse]);
  } catch (error: any) {
    console.error('Error generating chat response:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'An error occurred during response generation' });
    }
  }
});

export default router;
