import { useMemo, useState } from "react";
import { Plus, Clock, Trash2 } from "lucide-react";
import { useAppData } from "../../../store/AppDataContext";
import { formatDateBRFromISO, toISODate } from "../../calendar/dateUtils";
import { formatTimeInput, normalizeTime } from "../../../utils/datetime";

function formatEventTime(startTime: string, endTime: string): string {
  if (startTime && endTime) return `${startTime}–${endTime}`;
  if (startTime) return startTime;
  if (endTime) return `até ${endTime}`;
  return "";
}

export function UpcomingEvents() {
  const { events, addEvent, deleteEvent } = useAppData();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [timeError, setTimeError] = useState(false);

  const todayIso = toISODate(new Date());

  const upcoming = useMemo(
    () =>
      events
        .filter((event) => event.date >= todayIso)
        .sort((a, b) =>
          (a.date + (a.startTime || "99:99")).localeCompare(
            b.date + (b.startTime || "99:99"),
          ),
        )
        .slice(0, 8),
    [events, todayIso],
  );

  const add = () => {
    const value = title.trim();
    if (!value) return;
    const normalized = normalizeTime(time);
    if (time.trim() && !normalized) {
      setTimeError(true);
      return;
    }
    addEvent({
      title: value,
      date: todayIso,
      startTime: normalized ?? "",
      endTime: "",
    });
    setTitle("");
    setTime("");
    setTimeError(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 flex flex-col min-h-[140px]">
      <div className="text-sm font-medium text-zinc-100 mb-1">Próximos compromissos</div>
      <div className="text-[11px] text-zinc-500 mb-2">
        Novos itens entram na data de hoje; gerencie outras datas no Calendário.
      </div>
      <div className="flex gap-2 mb-2">
        <input
          value={time}
          onChange={(e) => {
            setTime(formatTimeInput(e.target.value));
            setTimeError(false);
          }}
          onBlur={() => {
            if (!time.trim()) return;
            const normalized = normalizeTime(time);
            if (normalized) setTime(normalized);
            else setTimeError(true);
          }}
          placeholder="HH:MM"
          inputMode="numeric"
          className={`w-24 bg-zinc-900/70 border rounded-md px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-sky-500/50 ${
            timeError ? "border-red-500/70" : "border-white/10"
          }`}
          title="Informe o horário (ex.: 1000 vira 10:00)"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Novo compromisso..."
          className="flex-1 bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-sky-500/50"
        />
        <button type="button" onClick={add} className="p-1.5 rounded-md bg-white/10 hover:bg-white/15 text-zinc-100" title="Adicionar compromisso">
          <Plus size={14} />
        </button>
      </div>
      {timeError && <div className="text-[11px] text-red-400 mb-1">Horário inválido. Use o formato HH:MM (00:00–23:59).</div>}
      <div className="space-y-1 overflow-auto flex-1">
        {upcoming.length === 0 ? (
          <div className="text-xs text-zinc-500">Nenhum compromisso futuro.</div>
        ) : (
          upcoming.map((event) => {
            const timeLabel = formatEventTime(event.startTime, event.endTime);
            return (
              <div key={event.id} className="group flex items-center gap-2 text-xs text-zinc-200 bg-zinc-900/50 rounded-md px-2 py-1.5">
                <Clock size={12} className="text-sky-400 shrink-0" />
                <span className="flex-1 min-w-0 truncate">
                  <span className="text-zinc-100">{event.title}</span>
                  <span className="text-zinc-500">
                    {" • "}
                    {formatDateBRFromISO(event.date)}
                    {timeLabel ? ` ${timeLabel}` : ""}
                  </span>
                </span>
                <button type="button" onClick={() => deleteEvent(event.id)} className="opacity-60 hover:opacity-100 text-zinc-400" title="Remover compromisso">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
