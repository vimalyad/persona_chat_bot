import { GoogleGenAI } from '@google/genai';
import { prompts } from '../prompts';
import { ChatMessage, Persona } from '../types';
import { Response } from 'express';

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

function buildContents(messageHistory: ChatMessage[], userMessage: string) {
  const contents = messageHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  return contents;
}

export async function streamChatResponse(
  persona: Persona,
  messageHistory: ChatMessage[],
  userMessage: string,
  res: Response
): Promise<string> {
  const client = getAiClient();
  const systemPrompt = prompts[persona];

  if (!systemPrompt) {
    throw new Error(`Persona '${persona}' not found.`);
  }

  const contents = buildContents(messageHistory, userMessage);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let fullText = '';

  const response = await client.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
      thinkingConfig: {
        thinkingBudget: 2048,
      },
    }
  });

  for await (const chunk of response) {
    // Access the parts array directly to filter out thought parts
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;

    for (const part of parts) {
      // Skip thought parts — these are Gemini's internal reasoning
      if (part.thought) continue;

      const text = part.text || '';
      if (text) {
        fullText += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
  }

  res.write(`data: [DONE]\n\n`);
  res.end();

  return fullText.trim();
}
