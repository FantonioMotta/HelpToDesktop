import { useEffect, useMemo, useState } from "react";
import { Bell, CheckSquare, GripVertical, StickyNote } from "lucide-react";
import { useAppData } from "../../store/AppDataContext";
import { usePreferences } from "../../store/PreferencesContext";
import { useWindowDrag } from "../../hooks/useWindowDrag";

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export function CompactBar({ onExpand }: { onExpand: () => void | Promise<void> }) {
  const { tasks, notes, reminders } = useAppData();
  const { prefs } = usePreferences();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const time = useMemo(() => formatTime(now), [now]);
  const date = useMemo(() => formatDate(now), [now]);
  const activeTasks = tasks.filter((t) => !t.done).length;
  const pendingReminders = reminders.filter((r) => !r.notified).length;
  const blend = prefs.visualMode === "blend";
  // Blend mode keeps the bar glued to the top, so dragging is X-only there.
  const { dragging, handlers } = useWindowDrag(prefs.allowMove, blend);

  return (
    <div
      className={`h-11 min-w-[360px] max-w-[520px] px-3 text-zinc-100 flex items-center justify-between gap-2 select-none transition-[transform,background-color,margin,border-radius] duration-200 ${
        blend
          ? "mt-0 rounded-b-[20px] rounded-t-none border border-t-0 border-white/10 bg-zinc-900/45 backdrop-blur-xl shadow-md"
          : "mt-2 rounded-capsule border border-bar-border bg-bar-bg backdrop-blur-md shadow-bar"
      }`}
    >
      {prefs.allowMove && (
        <div
          {...handlers}
          className={`p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/10 shrink-0 touch-none select-none ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          title={blend ? "Arrastar na horizontal (fixo no topo)" : "Arrastar para mover a barra"}
        >
          <GripVertical size={16} className="pointer-events-none" />
        </div>
      )}
      <button
        type="button"
        onClick={() => void onExpand()}
        className="flex-1 min-w-0 flex items-center justify-between gap-4 px-1 rounded-md hover:bg-white/5 active:scale-[0.99] transition"
        title="Abrir HelpBar (expandir)"
      >
        <div className="flex items-center gap-2 text-sm font-medium tracking-tight">
          <span>{time}</span>
          <span className="text-zinc-400">•</span>
          <span className="text-zinc-300 capitalize">{date}</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-300">
          <span className="inline-flex items-center gap-1 text-xs" title="Tarefas ativas"><CheckSquare size={14} />{activeTasks}</span>
          <span className="inline-flex items-center gap-1 text-xs" title="Notas"><StickyNote size={14} />{notes.length}</span>
          <span className="inline-flex items-center gap-1 text-xs" title="Lembretes pendentes"><Bell size={14} />{pendingReminders}</span>
        </div>
      </button>
    </div>
  );
}
