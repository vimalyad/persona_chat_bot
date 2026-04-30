import type { ModelOption, Persona, PersonaMeta } from "../types";

export const SUGGESTIONS: Record<Persona, string[]> = {
  anshuman: [
    "How do I beat procrastination?",
    "Is it enough to just be a good coder?",
    "Why did you start Scaler?",
  ],
  abhimanyu: [
    "Do I need a degree to get a job?",
    "Why is the Indian education system broken?",
    "What's the most important thing for a founder?",
  ],
  kshitij: [
    "How do I stay motivated when coding is hard?",
    "Will AI replace backend engineers?",
    "What was your favorite memory at IIIT?",
  ],
};

export const PERSONA_META: Record<Persona, PersonaMeta> = {
  anshuman: {
    name: "Anshuman Singh",
    color: "bg-emerald-500",
    ring: "ring-emerald-500",
    image: "/anshuman.png",
  },
  abhimanyu: {
    name: "Abhimanyu Saxena",
    color: "bg-rose-500",
    ring: "ring-rose-500",
    image: "/abhimanyu.png",
  },
  kshitij: {
    name: "Kshitij Mishra",
    color: "bg-violet-500",
    ring: "ring-violet-500",
    image: "/kshitij.png",
  },
};

export const FALLBACK_MODEL: ModelOption = {
  id: "groq:llama-3.1-8b-instant",
  name: "Groq - llama-3.1-8b-instant",
};
