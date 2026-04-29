import axios from 'axios';
import type { ChatMessage, Persona, Session } from './types';

// Use the VITE_API_URL env variable or fallback to localhost during local dev
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
});

export const getSession = async (persona: Persona): Promise<{ session: Session; messages: ChatMessage[] }> => {
  const response = await api.get(`/sessions/${persona}`);
  return response.data;
};

export const resetSession = async (persona: Persona): Promise<{ session: Session; messages: ChatMessage[] }> => {
  const response = await api.post(`/sessions/${persona}/reset`);
  return response.data;
};

export const sendChatMessage = async (
  sessionId: string,
  persona: Persona,
  message: string
): Promise<{ response: string }> => {
  const response = await api.post('/chat', {
    sessionId,
    persona,
    message,
  });
  return response.data;
};
