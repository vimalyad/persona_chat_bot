import { Send } from "lucide-react";

type ChatInputProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatInput({
  inputRef,
  value,
  placeholder,
  disabled,
  onChange,
  onSubmit,
}: ChatInputProps) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 lg:py-5 border-t border-white/10 bg-slate-900 shrink-0">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex items-center gap-3 w-full bg-slate-800/60 border border-white/10 rounded-2xl px-3 py-2 lg:py-3 focus-within:border-blue-500 transition-colors"
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none px-4 py-2.5 lg:py-3 text-base lg:text-lg text-slate-100 placeholder:text-slate-500 disabled:opacity-50 min-w-0"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 hover:scale-105 transition-all disabled:bg-slate-700 disabled:text-slate-500 disabled:scale-100 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

