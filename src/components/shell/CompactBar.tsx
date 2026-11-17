import { useEffect, useMemo, useState } from "react";
import { Bell, CheckSquare, GripVertical, Mic, Square, StickyNote } from "lucide-react";
import { useAppData } from "../../store/AppDataContext";
import { usePreferences } from "../../store/PreferencesContext";
import { useWindowDrag } from "../../hooks/useWindowDrag";
import { useAtlas } from "../../features/atlas/AtlasContext";
import type { AtlasPhase } from "../../features/atlas/AtlasContext";

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

const ATLAS_LABEL: Record<AtlasPhase, string> = {
  idle: "",
  listening: "Ouvindo…",
  processing: "Transcrevendo…",
  awake: "ATLAS ativada",
  success: "Concluído",
  error: "Atenção",
};

export function CompactBar({ onExpand }: { onExpand: () => void | Promise<void> }) {
  const { tasks, notes, reminders } = useAppData();
  const { prefs } = usePreferences();
  const { phase, feedback, transcript, toggleListening, available } = useAtlas();
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
  const atlasActive = prefs.atlasEnabled && phase !== "idle";
  const atlasText = feedback?.text || transcript || ATLAS_LABEL[phase];
  const listening = phase === "listening";

  const openAtlas = () => {
    window.dispatchEvent(new CustomEvent("helpbar:open-module", { detail: "atlas" }));
  };

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
        className="flex items-center gap-2 px-1 rounded-md hover:bg-white/5 active:scale-[0.99] transition whitespace-nowrap"
        title="Abrir HelpBar (expandir)"
      >
        <span className="text-sm font-medium tracking-tight">{time}</span>
        <span className="text-zinc-400">•</span>
        <span className="text-sm font-medium tracking-tight text-zinc-300 capitalize">{date}</span>
      </button>

      <div className="flex-1 min-w-0" />

      {atlasActive ? (
        <button
          type="button"
          onClick={openAtlas}
          className={`min-w-0 max-w-[210px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border truncate ${
            phase === "error"
              ? "bg-amber-500/15 border-amber-500/40 text-amber-100"
              : phase === "success"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-100"
                : "bg-sky-500/15 border-sky-500/40 text-sky-100"
          }`}
          title={atlasText}
        >
          {listening || phase === "awake" ? (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
          ) : phase === "processing" ? (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
          ) : null}
          <span className="truncate">{atlasText}</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 text-zinc-300 shrink-0">
          <span className="inline-flex items-center gap-1 text-xs" title="Tarefas ativas"><CheckSquare size={14} />{activeTasks}</span>
          <span className="inline-flex items-center gap-1 text-xs" title="Notas"><StickyNote size={14} />{notes.length}</span>
          <span className="inline-flex items-center gap-1 text-xs" title="Lembretes pendentes"><Bell size={14} />{pendingReminders}</span>
        </div>
      )}

      {prefs.atlasEnabled && (
        <button
          type="button"
          onClick={() => void toggleListening()}
          disabled={!available}
          className={`shrink-0 p-1.5 rounded-md transition-colors disabled:opacity-40 ${
            listening
              ? "bg-red-500/20 text-red-200 hover:bg-red-500/30"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-white/10"
          }`}
          title={listening ? "ATLAS: parar e transcrever" : "ATLAS: falar um comando"}
        >
          {listening ? <Square size={15} /> : <Mic size={16} />}
        </button>
      )}
    </div>
  );
}
