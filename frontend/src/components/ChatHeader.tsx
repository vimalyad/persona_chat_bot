import { ChevronDown, Menu, RefreshCw } from "lucide-react";
import type { ModelOption, PersonaMeta } from "../types";

type ChatHeaderProps = {
  meta: PersonaMeta;
  availableModels: ModelOption[];
  selectedModel: string;
  isModelListLoading: boolean;
  onOpenSidebar: () => void;
  onReset: () => void;
  onModelChange: (modelId: string) => void;
};

export function ChatHeader({
  meta,
  availableModels,
  selectedModel,
  isModelListLoading,
  onOpenSidebar,
  onReset,
  onModelChange,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-4 lg:py-5 border-b border-white/10 bg-slate-950/90 backdrop-blur z-10 shrink-0">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden text-slate-400 hover:text-white mr-1"
          onClick={onOpenSidebar}
        >
          <Menu size={22} />
        </button>
        <img
          src={meta.image}
          alt={meta.name}
          className={`w-11 h-11 lg:w-14 lg:h-14 rounded-full object-cover shrink-0 ring-2 ${meta.ring}`}
        />
        <div>
          <h2 className="font-semibold text-lg md:text-xl lg:text-2xl leading-tight">
            {meta.name}
          </h2>
          <span className="text-emerald-400 text-sm lg:text-base flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full" />
            Online
          </span>
        </div>
      </div>
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-3 md:px-4 lg:px-5 py-2 lg:py-2.5 rounded-lg text-sm lg:text-base text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
      >
        <RefreshCw size={15} />
        <span className="hidden sm:inline">Reset</span>
      </button>

      <div className="relative">
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={availableModels.length === 0}
          className="appearance-none bg-white/5 border border-white/10 text-slate-300 text-sm lg:text-base rounded-lg pl-3 pr-8 py-2 lg:py-2.5 hover:bg-white/10 hover:text-white transition-all cursor-pointer outline-none focus:border-blue-500 max-w-[180px] truncate"
        >
          {availableModels.length === 0 && (
            <option value="" className="bg-slate-900 text-slate-100">
              {isModelListLoading ? "Loading models..." : "No models available"}
            </option>
          )}
          {availableModels.map((model) => (
            <option
              key={model.id}
              value={model.id}
              className="bg-slate-900 text-slate-100"
            >
              {model.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
    </header>
  );
}

