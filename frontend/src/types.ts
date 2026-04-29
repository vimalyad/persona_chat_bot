export type Role = "user" | "assistant";
export type Persona = "anshuman" | "abhimanyu" | "kshitij";

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

export type UiMessage = ChatMessage & {
  isError?: boolean;
  retryText?: string;
};

export type ModelOption = {
  id: string;
  name: string;
};

export type PersonaMeta = {
  name: string;
  color: string;
  ring: string;
  image: string;
};
