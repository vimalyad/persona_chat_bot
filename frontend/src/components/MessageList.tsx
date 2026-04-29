import { Check, Copy, RotateCcw, User } from "lucide-react";
import type { PersonaMeta, UiMessage } from "../types";

type MessageListProps = {
  messages: UiMessage[];
  meta: PersonaMeta;
  isStreaming: boolean;
  selectedModel: string;
  copiedMessageIndex: number | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onCopyMessage: (content: string, index: number) => void;
  onRetry: (index: number, text: string) => void;
};

export function MessageList({
  messages,
  meta,
  isStreaming,
  selectedModel,
  copiedMessageIndex,
  messagesEndRef,
  onCopyMessage,
  onRetry,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-5 w-full">
      {messages.map((message, index) => (
        <MessageItem
          key={index}
          message={message}
          index={index}
          isLatest={index === messages.length - 1}
          meta={meta}
          isStreaming={isStreaming}
          selectedModel={selectedModel}
          copiedMessageIndex={copiedMessageIndex}
          onCopyMessage={onCopyMessage}
          onRetry={onRetry}
        />
      ))}

      {isStreaming &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "assistant" &&
        messages[messages.length - 1].content && (
          <span className="inline-block w-2 h-5 bg-blue-400 animate-pulse ml-1" />
        )}
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageItem({
  message,
  index,
  isLatest,
  meta,
  isStreaming,
  selectedModel,
  copiedMessageIndex,
  onCopyMessage,
  onRetry,
}: {
  message: UiMessage;
  index: number;
  isLatest: boolean;
  meta: PersonaMeta;
  isStreaming: boolean;
  selectedModel: string;
  copiedMessageIndex: number | null;
  onCopyMessage: (content: string, index: number) => void;
  onRetry: (index: number, text: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full animate-slideUp ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex gap-3 w-full ${isUser ? "flex-row-reverse" : ""}`}
        style={{ maxWidth: "85%" }}
      >
        {isUser ? (
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
            <User size={18} />
          </div>
        ) : (
          <img
            src={meta.image}
            alt={meta.name}
            className="w-9 h-9 rounded-full object-cover shrink-0 mt-1"
          />
        )}
        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          <div
            className={`px-5 py-4 rounded-2xl text-base lg:text-lg leading-relaxed whitespace-pre-wrap
            ${
              isUser
                ? "bg-blue-600 rounded-tr-sm shadow-lg shadow-blue-500/20 text-white"
                : message.isError
                  ? "bg-rose-950/50 border border-rose-500/30 rounded-tl-sm text-rose-100"
                  : "bg-slate-800 border border-white/10 rounded-tl-sm text-slate-100"
            }`}
          >
            {!isUser && isStreaming && isLatest && !message.content ? (
              <ThinkingIndicator />
            ) : (
              message.content
            )}
          </div>
          {message.content && (
            <MessageActions
              message={message}
              index={index}
              isUser={isUser}
              copiedMessageIndex={copiedMessageIndex}
              isStreaming={isStreaming}
              selectedModel={selectedModel}
              onCopyMessage={onCopyMessage}
              onRetry={onRetry}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 min-w-36 text-slate-300">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-300 animate-bounce" />
        <span className="w-2 h-2 rounded-full bg-blue-300 animate-bounce [animation-delay:120ms]" />
        <span className="w-2 h-2 rounded-full bg-blue-300 animate-bounce [animation-delay:240ms]" />
      </div>
      <span className="text-sm lg:text-base bg-gradient-to-r from-slate-400 via-white to-slate-400 bg-clip-text text-transparent animate-pulse">
        Thinking
      </span>
    </div>
  );
}

function MessageActions({
  message,
  index,
  isUser,
  copiedMessageIndex,
  isStreaming,
  selectedModel,
  onCopyMessage,
  onRetry,
}: {
  message: UiMessage;
  index: number;
  isUser: boolean;
  copiedMessageIndex: number | null;
  isStreaming: boolean;
  selectedModel: string;
  onCopyMessage: (content: string, index: number) => void;
  onRetry: (index: number, text: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 mt-1.5 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <button
        type="button"
        onClick={() => onCopyMessage(message.content, index)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
        title="Copy message"
      >
        {copiedMessageIndex === index ? <Check size={15} /> : <Copy size={15} />}
      </button>
      {message.role === "assistant" && message.isError && message.retryText && (
        <button
          type="button"
          onClick={() => onRetry(index, message.retryText || "")}
          disabled={isStreaming || !selectedModel}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Retry response"
        >
          <RotateCcw size={15} />
        </button>
      )}
    </div>
  );
}

