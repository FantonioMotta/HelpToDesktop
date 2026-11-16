import { useMemo } from "react";
import { useAppData } from "../../../store/AppDataContext";
import { toISODate } from "../../calendar/dateUtils";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function MiniCalendar() {
  const { events } = useAppData();
  const today = new Date();
  const { year, month, cells, monthLabel, eventDays } = useMemo(() => {
    const y = today.getFullYear();
    const m = today.getMonth();
    const first = new Date(y, m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const arr: Array<number | null> = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    const label = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const days = new Set(events.map((event) => event.date));
    return { year: y, month: m, cells: arr, monthLabel: label, eventDays: days };
  }, [today.toDateString(), events]);

  const todayDate = today.getDate();

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-zinc-100 capitalize">{monthLabel}</div>
        <div className="text-[11px] text-zinc-400">Hoje: {today.toLocaleDateString("pt-BR")}</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-400 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {cells.map((d, i) => {
          const isToday = d === todayDate;
          const hasEvent = d ? eventDays.has(toISODate(new Date(year, month, d))) : false;
          return (
            <div
              key={i}
              className={`relative h-6 flex items-center justify-center rounded-md ${
                d ? "text-zinc-200" : ""
              } ${isToday ? "bg-sky-500/80 text-white font-semibold" : ""}`}
              title={hasEvent ? "Há compromissos neste dia" : undefined}
            >
              {d ?? ""}
              {hasEvent && (
                <span
                  className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                    isToday ? "bg-white/90" : "bg-sky-400"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
