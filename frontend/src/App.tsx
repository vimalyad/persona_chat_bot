import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  User,
  RefreshCw,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import type { Persona, ChatMessage } from "./types";
import {
  getSession,
  resetSession,
  sendChatMessageStream,
  getModels,
} from "./api";

type UiMessage = ChatMessage & {
  isError?: boolean;
  retryText?: string;
};

const SUGGESTIONS: Record<Persona, string[]> = {
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

const PERSONA_META: Record<
  Persona,
  { name: string; color: string; ring: string; image: string }
> = {
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

const MIN_SIDEBAR_W = 72;
const MAX_SIDEBAR_W = 480;
const DEFAULT_SIDEBAR_W = 320;
const COLLAPSED_W = 72;
const FALLBACK_MODEL = {
  id: "groq:allam-2-7b",
  name: "Groq · allam-2-7b",
};

const App: React.FC = () => {
  const [activePersona, setActivePersona] = useState<Persona>("anshuman");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_W);
  const [availableModels, setAvailableModels] = useState<
    { id: string; name: string }[]
  >([FALLBACK_MODEL]);
  const [selectedModel, setSelectedModel] = useState(FALLBACK_MODEL.id);
  const [isModelListLoading, setIsModelListLoading] = useState(true);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isStreaming]);

  const refreshAvailableModels = useCallback(async (forceRefresh = false) => {
    try {
      const models = await getModels(forceRefresh);
      setAvailableModels((current) => (models.length > 0 ? models : current));
      setSelectedModel((current) =>
        models.length > 0 && !models.some((model) => model.id === current)
          ? models[0].id
          : current,
      );
    } catch (err) {
      console.error("Failed to fetch models:", err);
    } finally {
      setIsModelListLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(
      () => void refreshAvailableModels(),
      0,
    );
    return () => window.clearTimeout(refreshTimer);
  }, [refreshAvailableModels]);

  // Auto-focus input on any keypress
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if already focused on an input, or modifier keys
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Only for printable characters
      if (e.key.length === 1) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Drag resize sidebar
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newW = Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, ev.clientX));
      setSidebarCollapsed(newW <= COLLAPSED_W + 20);
      setSidebarWidth(newW <= COLLAPSED_W + 20 ? COLLAPSED_W : newW);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      try {
        const data = await getSession(activePersona);
        setSessionId(data.session.id);
        setMessages(data.messages);
      } catch (e) {
        console.error("Failed to load session:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, [activePersona]);

  const copyMessage = useCallback(async (content: string, index: number) => {
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      window.setTimeout(
        () =>
          setCopiedMessageIndex((current) =>
            current === index ? null : current,
          ),
        1500,
      );
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  }, []);

  // Typewriter animation refs
  const fullTextRef = useRef("");
  const displayedLenRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const startTypewriter = useCallback(() => {
    if (animFrameRef.current) return;
    let lastTime = 0;
    const tick = (timestamp: number) => {
      const backlog = fullTextRef.current.length - displayedLenRef.current;
      if (backlog <= 0) {
        animFrameRef.current = null;
        return;
      }
      let delay: number, charsPerTick: number;
      if (backlog < 10) {
        delay = 25;
        charsPerTick = 1;
      } else if (backlog < 50) {
        delay = 12;
        charsPerTick = 2;
      } else if (backlog < 150) {
        delay = 5;
        charsPerTick = 3;
      } else {
        delay = 2;
        charsPerTick = 5;
      }
      if (timestamp - lastTime >= delay) {
        lastTime = timestamp;
        const newLen = Math.min(
          displayedLenRef.current + charsPerTick,
          fullTextRef.current.length,
        );
        displayedLenRef.current = newLen;
        const shown = fullTextRef.current.slice(0, newLen);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: shown,
          };
          return updated;
        });
      }
      if (displayedLenRef.current < fullTextRef.current.length) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || !sessionId || isStreaming || !selectedModel) return;
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInputMessage("");
      setIsStreaming(true);
      fullTextRef.current = "";
      displayedLenRef.current = 0;
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      await sendChatMessageStream(
        sessionId,
        activePersona,
        text,
        selectedModel,
        (chunk: string) => {
          fullTextRef.current += chunk;
          startTypewriter();
        },
        () => {
          const waitForFlush = () => {
            if (displayedLenRef.current >= fullTextRef.current.length) {
              setIsStreaming(false);
            } else {
              startTypewriter();
              requestAnimationFrame(waitForFlush);
            }
          };
          waitForFlush();
        },
        (error: string) => {
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: error,
              isError: true,
              retryText: text,
            };
            return updated;
          });
          setIsStreaming(false);
          void refreshAvailableModels(true);
        },
      );
    },
    [
      sessionId,
      activePersona,
      isStreaming,
      startTypewriter,
      selectedModel,
      refreshAvailableModels,
    ],
  );

  const handleRetry = useCallback(
    async (failedIndex: number, text: string) => {
      if (!text.trim() || !sessionId || isStreaming || !selectedModel) return;

      setIsStreaming(true);
      fullTextRef.current = "";
      displayedLenRef.current = 0;
      setMessages((prev) => {
        const updated = [...prev];
        updated[failedIndex] = { role: "assistant", content: "" };
        return updated;
      });

      await sendChatMessageStream(
        sessionId,
        activePersona,
        text,
        selectedModel,
        (chunk: string) => {
          fullTextRef.current += chunk;
          startTypewriter();
        },
        () => {
          const waitForFlush = () => {
            if (displayedLenRef.current >= fullTextRef.current.length) {
              setIsStreaming(false);
            } else {
              startTypewriter();
              requestAnimationFrame(waitForFlush);
            }
          };
          waitForFlush();
        },
        (error: string) => {
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
          setMessages((prev) => {
            const updated = [...prev];
            updated[failedIndex] = {
              role: "assistant",
              content: error,
              isError: true,
              retryText: text,
            };
            return updated;
          });
          setIsStreaming(false);
          void refreshAvailableModels(true);
        },
        false,
      );
    },
    [
      sessionId,
      activePersona,
      isStreaming,
      startTypewriter,
      selectedModel,
      refreshAvailableModels,
    ],
  );

  const handleReset = async () => {
    setIsLoading(true);
    try {
      const data = await resetSession(activePersona);
      setSessionId(data.session.id);
      setMessages(data.messages);
    } catch (e) {
      console.error("Failed to reset session:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaSwitch = (p: Persona) => {
    setActivePersona(p);
    setSidebarOpen(false);
  };

  const toggleCollapse = () => {
    setSidebarCollapsed((prev) => {
      if (!prev) {
        setSidebarWidth(COLLAPSED_W);
        return true;
      } else {
        setSidebarWidth(DEFAULT_SIDEBAR_W);
        return false;
      }
    });
  };

  const meta = PERSONA_META[activePersona];

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-inter">
      {/* ─── MOBILE OVERLAY ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── SIDEBAR (Desktop: resizable + collapsible, Mobile: drawer) ─── */}
      <aside
        className={`
          fixed lg:relative z-30 lg:z-auto
          flex flex-col h-full shrink-0
          bg-slate-900 border-r border-white/10
          transition-all duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{
          width:
            typeof window !== "undefined" && window.innerWidth >= 1024
              ? sidebarWidth
              : undefined,
        }}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-white/10 ${sidebarCollapsed ? "justify-center px-2 py-4" : "justify-between px-5 py-5"}`}
        >
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent truncate">
                Scaler Mentors
              </h1>
              <p className="text-slate-400 text-sm mt-0.5 truncate">
                Chat with your mentors
              </p>
            </div>
          )}
          {/* Collapse toggle (desktop only) */}
          <button
            className="hidden lg:flex text-slate-400 hover:text-white shrink-0"
            onClick={toggleCollapse}
          >
            {sidebarCollapsed ? (
              <PanelLeft size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </button>
          {/* Close (mobile only) */}
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Persona List */}
        <nav
          className={`flex flex-col gap-2 flex-1 ${sidebarCollapsed ? "items-center p-2" : "p-4"}`}
        >
          {(Object.keys(PERSONA_META) as Persona[]).map((p) => {
            const m = PERSONA_META[p];
            const isActive = activePersona === p;

            if (sidebarCollapsed) {
              return (
                <button
                  key={p}
                  onClick={() => handlePersonaSwitch(p)}
                  className={`p-1.5 rounded-full transition-all duration-200 ${isActive ? "ring-2 " + m.ring : "hover:ring-2 hover:ring-white/20"}`}
                  title={m.name}
                >
                  <img
                    src={m.image}
                    alt={m.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                </button>
              );
            }

            return (
              <button
                key={p}
                onClick={() => handlePersonaSwitch(p)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 w-full
                  ${
                    isActive
                      ? "bg-white/10 border border-white/20 text-white shadow-md"
                      : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
              >
                <img
                  src={m.image}
                  alt={m.name}
                  className={`w-10 h-10 rounded-full object-cover shrink-0 ring-2 ${isActive ? m.ring : "ring-transparent"}`}
                />
                <span className="font-medium text-base truncate">{m.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Drag handle */}
        <div
          className="hidden lg:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-40"
          onMouseDown={handleDragStart}
        />
      </aside>

      {/* ─── MAIN CHAT ─── */}
      <main className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Chat Header */}
        <header className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-4 lg:py-5 border-b border-white/10 bg-slate-950/90 backdrop-blur z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-slate-400 hover:text-white mr-1"
              onClick={() => setSidebarOpen(true)}
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
            onClick={handleReset}
            className="flex items-center gap-2 px-3 md:px-4 lg:px-5 py-2 lg:py-2.5 rounded-lg text-sm lg:text-base text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
          >
            <RefreshCw size={15} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Model Selector */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={availableModels.length === 0}
              className="appearance-none bg-white/5 border border-white/10 text-slate-300 text-sm lg:text-base rounded-lg pl-3 pr-8 py-2 lg:py-2.5 hover:bg-white/10 hover:text-white transition-all cursor-pointer outline-none focus:border-blue-500 max-w-[180px] truncate"
            >
              {availableModels.length === 0 && (
                <option value="" className="bg-slate-900 text-slate-100">
                  {isModelListLoading
                    ? "Loading models..."
                    : "No models available"}
                </option>
              )}
              {availableModels.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  className="bg-slate-900 text-slate-100"
                >
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col">
          {/* Empty State */}
          {messages.length === 0 && !isLoading && (
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
                {SUGGESTIONS[activePersona].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-sm md:text-base hover:bg-blue-600 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message List */}
          <div className="flex flex-col gap-5 w-full">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex w-full animate-slideUp ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex gap-3 w-full ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  style={{ maxWidth: "85%" }}
                >
                  {msg.role === "user" ? (
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
                  <div
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`px-5 py-4 rounded-2xl text-base lg:text-lg leading-relaxed whitespace-pre-wrap
                      ${
                        msg.role === "user"
                          ? "bg-blue-600 rounded-tr-sm shadow-lg shadow-blue-500/20 text-white"
                          : msg.isError
                            ? "bg-rose-950/50 border border-rose-500/30 rounded-tl-sm text-rose-100"
                            : "bg-slate-800 border border-white/10 rounded-tl-sm text-slate-100"
                      }`}
                    >
                      {msg.role === "assistant" &&
                      isStreaming &&
                      idx === messages.length - 1 &&
                      !msg.content ? (
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
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.content && (
                      <div
                        className={`flex items-center gap-1.5 mt-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <button
                          type="button"
                          onClick={() => void copyMessage(msg.content, idx)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                          title="Copy message"
                        >
                          {copiedMessageIndex === idx ? (
                            <Check size={15} />
                          ) : (
                            <Copy size={15} />
                          )}
                        </button>
                        {msg.role === "assistant" &&
                          msg.isError &&
                          msg.retryText && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleRetry(idx, msg.retryText || "")
                              }
                              disabled={isStreaming || !selectedModel}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              title="Retry response"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isStreaming &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "assistant" &&
              messages[messages.length - 1].content && (
                <span className="inline-block w-2 h-5 bg-blue-400 animate-pulse ml-1" />
              )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="px-4 md:px-6 lg:px-8 py-4 lg:py-5 border-t border-white/10 bg-slate-900 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputMessage);
            }}
            className="flex items-center gap-3 w-full bg-slate-800/60 border border-white/10 rounded-2xl px-3 py-2 lg:py-3 focus-within:border-blue-500 transition-colors"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask ${meta.name} something...`}
              disabled={
                isLoading || isStreaming || !sessionId || !selectedModel
              }
              className="flex-1 bg-transparent outline-none px-4 py-2.5 lg:py-3 text-base lg:text-lg text-slate-100 placeholder:text-slate-500 disabled:opacity-50 min-w-0"
            />
            <button
              type="submit"
              disabled={
                !inputMessage.trim() ||
                isLoading ||
                isStreaming ||
                !sessionId ||
                !selectedModel
              }
              className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 hover:scale-105 transition-all disabled:bg-slate-700 disabled:text-slate-500 disabled:scale-100 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default App;
