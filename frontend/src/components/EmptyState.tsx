import { SUGGESTIONS } from "../config/personas";
import type { Persona, PersonaMeta } from "../types";

type EmptyStateProps = {
  activePersona: Persona;
  meta: PersonaMeta;
  onSend: (message: string) => void;
};

export function EmptyState({ activePersona, meta, onSend }: EmptyStateProps) {
  return (
    <div className="m-auto text-center w-full max-w-2xl px-4">
      <img
        src={meta.image}
        alt={meta.name}
        className={`w-24 h-24 lg:w-28 lg:h-28 rounded-full object-cover ring-4 ${meta.ring} mx-auto mb-6`}
      />
      <h3 className="text-2xl md:text-3xl font-semibold mb-3">
        Start a conversation
      </h3>
      <p className="text-slate-400 text-base md:text-lg mb-8">
        Ask {meta.name} anything — try one of these:
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        {SUGGESTIONS[activePersona].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSend(suggestion)}
            className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-sm md:text-base hover:bg-blue-600 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5 transition-all duration-200"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

