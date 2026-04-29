export type Role = 'user' | 'assistant';
export type Persona = 'anshuman' | 'abhimanyu' | 'kshitij';

export interface ChatMessage {
  id?: number;
  session_id?: string;
  role: Role;
  content: string;
  created_at?: string;
}

export interface Session {
  id: string;
  persona: Persona;
  created_at?: string;
}
