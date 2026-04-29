export type Role = "user" | "assistant";

export interface ChatMessage {
  id?: number;
  session_id?: string;
  role: Role;
  content: string;
  created_at?: Date;
}

export type Persona = "anshuman" | "abhimanyu" | "kshitij";
