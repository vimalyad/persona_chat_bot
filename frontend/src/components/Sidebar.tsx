import { PanelLeft, PanelLeftClose, X } from "lucide-react";
import { PERSONA_META } from "../config/personas";
import type { Persona } from "../types";

type SidebarProps = {
  activePersona: Persona;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  onClose: () => void;
  onPersonaSwitch: (persona: Persona) => void;
  onToggleCollapse: () => void;
  onDragStart: (event: React.MouseEvent) => void;
};

export function Sidebar({
  activePersona,
  sidebarOpen,
  sidebarCollapsed,
  sidebarWidth,
  onClose,
  onPersonaSwitch,
  onToggleCollapse,
  onDragStart,
}: SidebarProps) {
  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

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
          <button
            className="hidden lg:flex text-slate-400 hover:text-white shrink-0"
            onClick={onToggleCollapse}
          >
            {sidebarCollapsed ? (
              <PanelLeft size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </button>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <nav
          className={`flex flex-col gap-2 flex-1 ${sidebarCollapsed ? "items-center p-2" : "p-4"}`}
        >
          {(Object.keys(PERSONA_META) as Persona[]).map((persona) => (
            <PersonaButton
              key={persona}
              persona={persona}
              isActive={activePersona === persona}
              isCollapsed={sidebarCollapsed}
              onClick={() => onPersonaSwitch(persona)}
            />
          ))}
        </nav>

        <div
          className="hidden lg:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-40"
          onMouseDown={onDragStart}
        />
      </aside>
    </>
  );
}

function PersonaButton({
  persona,
  isActive,
  isCollapsed,
  onClick,
}: {
  persona: Persona;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}) {
  const meta = PERSONA_META[persona];

  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        className={`p-1.5 rounded-full transition-all duration-200 ${isActive ? "ring-2 " + meta.ring : "hover:ring-2 hover:ring-white/20"}`}
        title={meta.name}
      >
        <img
          src={meta.image}
          alt={meta.name}
          className="w-10 h-10 rounded-full object-cover"
        />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 w-full
        ${
          isActive
            ? "bg-white/10 border border-white/20 text-white shadow-md"
            : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
        }`}
    >
      <img
        src={meta.image}
        alt={meta.name}
        className={`w-10 h-10 rounded-full object-cover shrink-0 ring-2 ${isActive ? meta.ring : "ring-transparent"}`}
      />
      <span className="font-medium text-base truncate">{meta.name}</span>
    </button>
  );
}

