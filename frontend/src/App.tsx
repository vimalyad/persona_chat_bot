import { useEffect, useRef, useState } from "react";
import { ChatHeader } from "./components/ChatHeader";
import { ChatInput } from "./components/ChatInput";
import { EmptyState } from "./components/EmptyState";
import { MessageList } from "./components/MessageList";
import { Sidebar } from "./components/Sidebar";
import { PERSONA_META } from "./config/personas";
import { useAutoFocusInput } from "./hooks/useAutoFocusInput";
import { useAvailableModels } from "./hooks/useAvailableModels";
import { useChatSession } from "./hooks/useChatSession";
import { useClipboardFeedback } from "./hooks/useClipboard";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useStreamingChat } from "./hooks/useStreamingChat";
import type { Persona } from "./types";

const App: React.FC = () => {
  const [activePersona, setActivePersona] = useState<Persona>("anshuman");
  const [inputMessage, setInputMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    availableModels,
    selectedModel,
    setSelectedModel,
    isModelListLoading,
    refreshAvailableModels,
  } = useAvailableModels();

  const { messages, setMessages, sessionId, isLoading, resetCurrentSession } =
    useChatSession(activePersona);

  const {
    sidebarCollapsed,
    sidebarWidth,
    handleDragStart,
    toggleCollapse,
  } = useSidebarResize();

  const { copiedMessageIndex, copyMessage } = useClipboardFeedback();

  const { isStreaming, sendMessage, retryMessage } = useStreamingChat({
    activePersona,
    sessionId,
    selectedModel,
    setMessages,
    refreshAvailableModels,
  });

  useAutoFocusInput(inputRef);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isStreaming]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInputMessage("");
    await sendMessage(text);
  };

  const handlePersonaSwitch = (persona: Persona) => {
    setActivePersona(persona);
    setSidebarOpen(false);
  };

  const meta = PERSONA_META[activePersona];
  const inputDisabled = isLoading || isStreaming || !sessionId || !selectedModel;

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-inter">
      <Sidebar
        activePersona={activePersona}
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        sidebarWidth={sidebarWidth}
        onClose={() => setSidebarOpen(false)}
        onPersonaSwitch={handlePersonaSwitch}
        onToggleCollapse={toggleCollapse}
        onDragStart={handleDragStart}
      />

      <main className="flex flex-col flex-1 overflow-hidden min-w-0">
        <ChatHeader
          meta={meta}
          availableModels={availableModels}
          selectedModel={selectedModel}
          isModelListLoading={isModelListLoading}
          onOpenSidebar={() => setSidebarOpen(true)}
          onReset={() => void resetCurrentSession()}
          onModelChange={setSelectedModel}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col">
          {messages.length === 0 && !isLoading && (
            <EmptyState
              activePersona={activePersona}
              meta={meta}
              onSend={(message) => void handleSend(message)}
            />
          )}

          <MessageList
            messages={messages}
            meta={meta}
            isStreaming={isStreaming}
            selectedModel={selectedModel}
            copiedMessageIndex={copiedMessageIndex}
            messagesEndRef={messagesEndRef}
            onCopyMessage={(content, index) => void copyMessage(content, index)}
            onRetry={(index, text) => void retryMessage(index, text)}
          />
        </div>

        <ChatInput
          inputRef={inputRef}
          value={inputMessage}
          placeholder={`Ask ${meta.name} something...`}
          disabled={inputDisabled}
          onChange={setInputMessage}
          onSubmit={() => void handleSend(inputMessage)}
        />
      </main>
    </div>
  );
};

export default App;

