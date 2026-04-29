import { GoogleGenAI } from '@google/genai';
import { prompts } from '../prompts';
import { ChatMessage, Persona } from '../types';

// We initialize it lazily to ensure process.env is populated by dotenv
let ai: GoogleGenAI | null = null;

function getAiClient() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

export async function generateChatResponse(persona: Persona, messageHistory: ChatMessage[], userMessage: string): Promise<string> {
  const client = getAiClient();
  const systemPrompt = prompts[persona];
  
  if (!systemPrompt) {
    throw new Error(`Persona '${persona}' not found.`);
  }

  // Map our generic role format ('user'/'assistant') to Gemini's format ('user'/'model')
  const contents = messageHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    }
  });

  const rawText = response.text || "";
  
  // Strip out the internal reasoning from the final message
  const cleanText = rawText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

  return cleanText || "Sorry, I couldn't generate a response.";
}
