import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, RefreshCw } from 'lucide-react';
import type { Persona, ChatMessage } from './types';
import { getSession, resetSession, sendChatMessage } from './api';

const SUGGESTIONS: Record<Persona, string[]> = {
  anshuman: ["How do I beat procrastination?", "Is it enough to just be a good coder?", "Why did you start Scaler?"],
  abhimanyu: ["Do I need a degree to get a job?", "Why is the Indian education system broken?", "What's the most important thing for a founder?"],
  kshitij: ["How do I stay motivated when coding is hard?", "Will AI replace backend engineers?", "What was your favorite memory at IIIT?"],
};

const PERSONA_META: Record<Persona, { name: string; color: string; initial: string }> = {
  anshuman: { name: "Anshuman Singh", color: "bg-emerald-500", initial: "A" },
  abhimanyu: { name: "Abhimanyu Saxena", color: "bg-amber-500", initial: "Ab" },
  kshitij: { name: "Kshitij Mishra", color: "bg-violet-500", initial: "K" },
};

const App: React.FC = () => {
  const [activePersona, setActivePersona] = useState<Persona>('anshuman');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

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

  const handleSend = async (text: string) => {
    if (!text.trim() || !sessionId) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);
    try {
      const data = await sendChatMessage(sessionId, activePersona, text);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

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

  const meta = PERSONA_META[activePersona];

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* ─── SIDEBAR ─── */}
      <aside className="w-72 shrink-0 flex flex-col bg-slate-900/70 backdrop-blur border-r border-white/10">
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Scaler Mentors
          </h1>
          <p className="text-slate-400 text-sm mt-1">Select a persona to chat with</p>
        </div>

        <nav className="flex flex-col gap-2 p-4">
          {(Object.keys(PERSONA_META) as Persona[]).map((p) => {
            const m = PERSONA_META[p];
            const isActive = activePersona === p;
            return (
              <button
                key={p}
                onClick={() => setActivePersona(p)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 
                  ${isActive
                    ? 'bg-white/10 border border-white/20 text-white shadow-md'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
              >
                <span className={`${m.color} w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0`}>
                  {m.initial}
                </span>
                <span className="font-medium">{m.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ─── MAIN CHAT ─── */}
      <main className="flex flex-col flex-1 overflow-hidden">

        {/* Chat Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <span className={`${meta.color} w-11 h-11 rounded-full flex items-center justify-center font-bold text-white`}>
              {meta.initial}
            </span>
            <div>
              <h2 className="font-semibold text-lg">{meta.name}</h2>
              <span className="text-emerald-400 text-xs flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Online
              </span>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
          >
            <RefreshCw size={15} />
            Reset Chat
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col">

          {/* Empty State */}
          {messages.length === 0 && !isLoading && (
            <div className="m-auto text-center max-w-xl animate-fadeIn">
              <div className="w-20 h-20 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-6">
                <Bot size={40} />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Start a conversation</h3>
              <p className="text-slate-400 mb-8">Ask {meta.name} anything — try a suggestion below.</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {SUGGESTIONS[activePersona].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-sm hover:bg-blue-600 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message List */}
          <div className="flex flex-col gap-6 max-w-3xl w-full mx-auto">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex animate-slideUp ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1
                    ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-blue-600 rounded-tr-sm shadow-lg shadow-blue-500/20'
                      : 'bg-slate-800 border border-white/10 rounded-tl-sm'}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex justify-start animate-slideUp">
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={16} />
                  </div>
                  <div className="bg-slate-800 border border-white/10 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce3 delay-100" />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce3 delay-200" />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce3" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-900">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(inputMessage); }}
            className="flex items-center gap-3 max-w-3xl mx-auto bg-slate-800/60 border border-white/10 rounded-2xl px-2 py-2 focus-within:border-blue-500 transition-colors"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask ${meta.name} something...`}
              disabled={isLoading || !sessionId}
              className="flex-1 bg-transparent outline-none px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading || !sessionId}
              className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 hover:scale-105 transition-all disabled:bg-slate-700 disabled:text-slate-500 disabled:scale-100 disabled:cursor-not-allowed"
            >
              <Send size={17} />
            </button>
          </form>
        </div>

      </main>
    </div>
  );
};

export default App;
