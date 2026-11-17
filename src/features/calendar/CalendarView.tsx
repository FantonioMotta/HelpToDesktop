import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { CalendarEvent, CalendarViewMode } from "./types";
import { addDays, brToISO, formatDateBRFromISO, parseISODate, sameDay, startOfWeek, toISODate } from "./dateUtils";
import { formatDateInput, formatTimeInput, isValidDateBR, normalizeTime } from "../../utils/datetime";
import { useAppData } from "../../store/AppDataContext";
import { ColorPicker } from "../../components/ColorPicker";
import { COLOR_OPTIONS, chipStyle, colorHex, dotStyle, type ColorKey } from "../../utils/colors";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatEventTime(e: CalendarEvent) {
  if (e.startTime && e.endTime) return `${e.startTime}–${e.endTime}`;
  if (e.startTime) return e.startTime;
  if (e.endTime) return `até ${e.endTime}`;
  return "";
}

function EventForm({
  initialDate,
  onAdd,
}: {
  initialDate: string;
  onAdd: (e: Omit<CalendarEvent, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(formatDateBRFromISO(initialDate));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState<string>("none");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const t = title.trim();
    if (!t) {
      setError("Informe um título.");
      return;
    }
    if (!isValidDateBR(date)) {
      setError("Data inválida. Use DD/MM/AAAA.");
      return;
    }
    const iso = brToISO(date);
    if (!iso) {
      setError("Data inválida.");
      return;
    }
    const ns = startTime.trim() ? normalizeTime(startTime) : "";
    const ne = endTime.trim() ? normalizeTime(endTime) : "";
    if (startTime.trim() && !ns) {
      setError("Horário de início inválido. Use HH:MM.");
      return;
    }
    if (endTime.trim() && !ne) {
      setError("Horário de fim inválido. Use HH:MM.");
      return;
    }
    if (ns && ne && ne < ns) {
      setError("O horário de fim deve ser igual ou após o início.");
      return;
    }
    onAdd({ title: t, date: iso, startTime: ns || "", endTime: ne || "", notes: notes.trim() || undefined, color });
    setTitle("");
    setStartTime("");
    setEndTime("");
    setNotes("");
    setColor("none");
    setError(null);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 space-y-2">
      <div className="text-sm font-medium text-zinc-100">Novo compromisso</div>
      <div className="grid grid-cols-3 gap-2">
        <input
          value={date}
          onChange={(e) => setDate(formatDateInput(e.target.value))}
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
          className="bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50 col-span-1"
          title="Data"
        />
        <input
          value={startTime}
          onChange={(e) => setStartTime(formatTimeInput(e.target.value))}
          onBlur={() => {
            if (startTime.trim()) {
              const n = normalizeTime(startTime);
              if (n) setStartTime(n);
            }
          }}
          placeholder="Início HH:MM"
          inputMode="numeric"
          className="bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50"
          title="Horário de início"
        />
        <input
          value={endTime}
          onChange={(e) => setEndTime(formatTimeInput(e.target.value))}
          onBlur={() => {
            if (endTime.trim()) {
              const n = normalizeTime(endTime);
              if (n) setEndTime(n);
            }
          }}
          placeholder="Fim HH:MM"
          inputMode="numeric"
          className="bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50"
          title="Horário de fim"
        />
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do compromisso"
        className="w-full bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Notas (opcional)"
        className="w-full bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50"
      />
      <ColorPicker value={color} onChange={(key: ColorKey) => setColor(key)} />
      {error && <div className="text-[11px] text-red-400">{error}</div>}
      <button type="button" onClick={submit} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-600/80 hover:bg-sky-600 text-white text-xs">
        <Plus size={14} /> Adicionar
      </button>
    </div>
  );
}

function nextColor(current: string | undefined): ColorKey {
  const idx = COLOR_OPTIONS.findIndex((c) => c.key === (current ?? "none"));
  return COLOR_OPTIONS[(idx + 1) % COLOR_OPTIONS.length].key;
}

function EventList({
  events,
  onRemove,
  onChangeColor,
}: {
  events: CalendarEvent[];
  onRemove: (id: string) => void;
  onChangeColor: (id: string, color: ColorKey) => void;
}) {
  if (events.length === 0) return <div className="text-xs text-zinc-500">Nenhum compromisso.</div>;
  const sorted = [...events].sort((a, b) => (a.date + (a.startTime || "99:99")).localeCompare(b.date + (b.startTime || "99:99")));
  return (
    <div className="space-y-1">
      {sorted.map((e) => (
        <div
          key={e.id}
          className="group flex items-start gap-2 text-xs bg-zinc-900/50 rounded-md px-2 py-1.5 border"
          style={{ borderColor: colorHex(e.color) ? `${colorHex(e.color)}66` : "rgba(255,255,255,0.05)" }}
        >
          <button
            type="button"
            onClick={() => onChangeColor(e.id, nextColor(e.color))}
            className="mt-0.5 shrink-0 rounded-full transition-transform hover:scale-125"
            title="Alterar cor"
          >
            <span className="block w-2.5 h-2.5 rounded-full" style={dotStyle(e.color)} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-zinc-100 font-medium truncate">{e.title}</div>
            <div className="text-zinc-400">
              {formatDateBRFromISO(e.date)}
              {formatEventTime(e) ? ` • ${formatEventTime(e)}` : ""}
            </div>
            {e.notes && <div className="text-zinc-500 truncate">{e.notes}</div>}
          </div>
          <button type="button" onClick={() => onRemove(e.id)} className="opacity-60 hover:opacity-100 text-zinc-400 mt-0.5" title="Remover">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function CalendarView() {
  const { events, addEvent, updateEvent, deleteEvent } = useAppData();
  const [mode, setMode] = useState<CalendarViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const today = new Date();

  const selectedDate = toISODate(cursor);

  const addEventHandler = (e: Omit<CalendarEvent, "id">) => addEvent(e);
  const removeEvent = (id: string) => deleteEvent(id);
  const changeEventColor = (id: string, color: ColorKey) => updateEvent(id, { color });

  const headerLabel = useMemo(() => {
    if (mode === "month") return cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (mode === "week") {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);
      return `${start.toLocaleDateString("pt-BR")} - ${end.toLocaleDateString("pt-BR")}`;
    }
    return cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }, [mode, cursor]);

  const navigate = (dir: -1 | 1) => {
    setCursor((c) => {
      const d = new Date(c);
      if (mode === "month") d.setMonth(d.getMonth() + dir);
      else if (mode === "week") d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const monthCells = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: Array<{ date: Date | null; iso?: string }> = [];
    for (let i = 0; i < startDay; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      cells.push({ date: dt, iso: toISODate(dt) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const eventsForDay = (iso: string) => events.filter((e) => e.date === iso);
  const eventsForRange = (days: Date[]) => {
    const set = new Set(days.map(toISODate));
    return events.filter((e) => set.has(e.date));
  };

  const visibleEvents =
    mode === "day" ? eventsForDay(selectedDate) : mode === "week" ? eventsForRange(weekDays) : events.filter((e) => parseISODate(e.date).getMonth() === cursor.getMonth() && parseISODate(e.date).getFullYear() === cursor.getFullYear());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="p-1.5 rounded-md hover:bg-white/10 text-zinc-300"><ChevronLeft size={16} /></button>
          <div className="text-sm font-medium text-zinc-100 capitalize min-w-[220px] text-center">{headerLabel}</div>
          <button type="button" onClick={() => navigate(1)} className="p-1.5 rounded-md hover:bg-white/10 text-zinc-300"><ChevronRight size={16} /></button>
          <button type="button" onClick={() => setCursor(new Date())} className="px-2 py-1 text-xs rounded-md bg-white/10 hover:bg-white/15 text-zinc-200">Hoje</button>
        </div>
        <div className="flex items-center gap-1 bg-zinc-800/70 border border-white/10 rounded-lg p-0.5">
          {(["month", "week", "day"] as CalendarViewMode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`px-2.5 py-1 text-xs rounded-md capitalize ${mode === m ? "bg-white/15 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
              {m === "month" ? "Mensal" : m === "week" ? "Semanal" : "Diário"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3">
        <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 min-h-[460px]">
          {mode === "month" && (
            <div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-400 mb-1">
                {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((c, i) => {
                  if (!c.date || !c.iso) return <div key={i} className="h-16 rounded-md" />;
                  const isToday = sameDay(c.date, today);
                  const isSelected = c.iso === selectedDate;
                  const dayEvents = eventsForDay(c.iso);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCursor(c.date!)}
                      onDoubleClick={() => {
                        setCursor(c.date!);
                        setMode("day");
                      }}
                      className={`h-24 rounded-md border text-left p-1.5 transition-colors ${isSelected ? "border-sky-500/60 bg-sky-500/10" : "border-white/5 hover:bg-white/5"} ${isToday ? "ring-1 ring-sky-400/50" : ""}`}
                      title="Clique duplo para abrir a visão diária"
                    >
                      <div className={`text-xs ${isToday ? "text-sky-300 font-semibold" : "text-zinc-300"}`}>{c.date.getDate()}</div>
                      <div className="mt-1 space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className="text-[11px] truncate rounded px-1 py-0.5 border"
                            style={chipStyle(e.color)}
                          >
                            {formatEventTime(e) ? `${formatEventTime(e)} ` : ""}{e.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div className="text-[10px] text-zinc-400">+{dayEvents.length - 3}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "week" && (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const iso = toISODate(d);
                const isToday = sameDay(d, today);
                const isSelected = iso === selectedDate;
                const dayEvents = eventsForDay(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setCursor(d)}
                    onDoubleClick={() => {
                      setCursor(d);
                      setMode("day");
                    }}
                    className={`min-h-[360px] rounded-md border p-2 text-left ${isSelected ? "border-sky-500/60 bg-sky-500/10" : "border-white/5 hover:bg-white/5"} ${isToday ? "ring-1 ring-sky-400/50" : ""}`}
                    title="Clique duplo para abrir a visão diária"
                  >
                    <div className="text-[11px] text-zinc-400">{WEEKDAYS[d.getDay()]}</div>
                    <div className={`text-sm mb-1 ${isToday ? "text-sky-300 font-semibold" : "text-zinc-200"}`}>{d.getDate()}</div>
                    <div className="space-y-1">
                      {dayEvents.length === 0 ? <div className="text-[10px] text-zinc-500">—</div> : dayEvents.map((e) => (
                        <div
                          key={e.id}
                          className="text-[10px] rounded px-1 py-0.5 truncate border"
                          style={chipStyle(e.color)}
                        >
                          {formatEventTime(e) ? `${formatEventTime(e)} ` : ""}{e.title}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {mode === "day" && (
            <div>
              <div className="text-sm text-zinc-300 mb-2 capitalize">{cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
              <EventList events={eventsForDay(selectedDate)} onRemove={removeEvent} onChangeColor={changeEventColor} />
            </div>
          )}
        </div>

        <div className="space-y-3 overflow-auto max-h-[560px] pr-1">
          <EventForm key={selectedDate} initialDate={selectedDate} onAdd={addEventHandler} />
          <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3">
            <div className="text-sm font-medium text-zinc-100 mb-2">
              {mode === "month" ? "Compromissos do mês" : mode === "week" ? "Compromissos da semana" : "Compromissos do dia"}
            </div>
            <EventList events={visibleEvents} onRemove={removeEvent} onChangeColor={changeEventColor} />
          </div>
        </div>
      </div>
    </div>
  );
}
