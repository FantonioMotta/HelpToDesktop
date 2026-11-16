import {
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  Pin,
  PinOff,
  Settings,
  StickyNote,
  Bell,
  X,
} from "lucide-react";
import type { ShellMode, ShellModule } from "../../types/shell";
import { DashboardView } from "../../features/dashboard/DashboardView";
import { CalendarView } from "../../features/calendar/CalendarView";
import { TasksView } from "../../features/tasks/TasksView";
import { NotesView } from "../../features/notes/NotesView";
import { RemindersView } from "../../features/reminders/RemindersView";
import { SettingsView } from "../../features/settings/SettingsView";


const modules: { id: ShellModule; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "tasks", label: "Tarefas", icon: CheckSquare },
  { id: "notes", label: "Notas", icon: StickyNote },
  { id: "reminders", label: "Lembretes", icon: Bell },
  { id: "settings", label: "Config.", icon: Settings },
];

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3">
      <div className="text-sm font-medium text-zinc-100">{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{description}</div>
      <div className="mt-3 text-xs text-zinc-500">Este módulo será detalhado nas próximas etapas.</div>
    </div>
  );
}

function ModuleContent({ module }: { module: ShellModule }) {
  if (module === "dashboard") return <DashboardView />;
  if (module === "calendar") return <CalendarView />;
  if (module === "tasks") return <TasksView />;
  if (module === "notes") return <NotesView />;
  if (module === "reminders") return <RemindersView />;
  return <SettingsView />;
}

export function ExpandedPanel({
  mode,
  activeModule,
  onSelectModule,
  onCollapse,
  onTogglePin,
}: {
  mode: ShellMode;
  activeModule: ShellModule;
  onSelectModule: (m: ShellModule) => void;
  onCollapse: () => void;
  onTogglePin: () => void;
}) {
  const pinned = mode === "focus";
  return (
    <div className="mt-2 w-[1020px] h-[700px] rounded-2xl border border-bar-border bg-zinc-900/95 shadow-bar backdrop-blur-md text-zinc-100 flex flex-col overflow-hidden animate-[panelIn_.18s_ease-out]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <nav className="flex items-center gap-1 overflow-x-auto">
          {modules.map(({ id, label, icon: Icon }) => {
            const active = id === activeModule;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectModule(id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  active ? "bg-white/15 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg transition-colors ${pinned ? "bg-white/15 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
            title={pinned ? "Desafixar (modo expandido)" : "Fixar painel (modo foco)"}
          >
            {pinned ? <Pin size={15} /> : <PinOff size={15} />}
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            title="Recolher"
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <ModuleContent module={activeModule} />
      </div>
      <div className="px-4 py-2 border-t border-white/10 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>{pinned ? "Modo foco: painel fixado" : "Modo expandido: recolhe ao perder foco"}</span>
        <span>Dados locais • Etapa 8</span>
      </div>
    </div>
  );
}
