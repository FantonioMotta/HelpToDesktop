import { useMemo, useState } from "react";
import { Bell, BellRing, Plus, Trash2 } from "lucide-react";
import { useAppData } from "../../store/AppDataContext";
import { formatDateInput, formatTimeInput, isValidDateBR, normalizeTime } from "../../utils/datetime";

function brToEpoch(dateBR: string, time: string): number | null {
  if (!isValidDateBR(dateBR)) return null;
  const [d, m, y] = dateBR.split("/").map((n) => parseInt(n, 10));
  const nt = normalizeTime(time);
  if (!nt) return null;
  const [hh, mm] = nt.split(":").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return dt.getTime();
}

export function RemindersView() {
  const { reminders, addReminder, deleteReminder } = useAppData();
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("pt-BR"));
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => [...reminders].sort((a, b) => a.dueAt - b.dueAt), [reminders]);

  const add = () => {
    const v = text.trim();
    if (!v) {
      setError("Informe o texto do lembrete.");
      return;
    }
    const dueAt = brToEpoch(date, time);
    if (!dueAt) {
      setError("Informe data e horário válidos (DD/MM/AAAA e HH:MM).");
      return;
    }
    addReminder({ text: v, dueAt });
    setText("");
    setTime("");
    setError(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2"><Bell size={18} /> Lembretes</h2>
        <p className="text-xs text-zinc-400">Agende lembretes com data e hora. Notificações nativas são disparadas quando o horário chega (app em execução, permissão concedida).</p>
      </div>

      <div className="grid grid-cols-[340px_1fr] gap-3">
        <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 space-y-2 h-fit">
          <div className="text-sm font-medium text-zinc-100">Novo lembrete</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: Comprar ração"
            className="w-full bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={date}
              onChange={(e) => setDate(formatDateInput(e.target.value))}
              placeholder="DD/MM/AAAA"
              inputMode="numeric"
              className="bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50"
            />
            <input
              value={time}
              onChange={(e) => setTime(formatTimeInput(e.target.value))}
              onBlur={() => {
                if (time.trim()) {
                  const n = normalizeTime(time);
                  if (n) setTime(n);
                }
              }}
              placeholder="HH:MM"
              inputMode="numeric"
              className="bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50"
            />
          </div>
          {error && <div className="text-[11px] text-red-400">{error}</div>}
          <button type="button" onClick={add} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-600/80 hover:bg-sky-600 text-white text-xs">
            <Plus size={14} /> Agendar lembrete
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 space-y-2">
          <div className="text-sm font-medium text-zinc-100">Lembretes agendados ({reminders.length})</div>
          <div className="space-y-1 max-h-[500px] overflow-auto pr-1">
            {sorted.length === 0 ? (
              <div className="text-sm text-zinc-500 py-6 text-center">Nenhum lembrete agendado.</div>
            ) : (
              sorted.map((r) => {
                const due = new Date(r.dueAt);
                const past = r.dueAt <= Date.now();
                return (
                  <div key={r.id} className="group flex items-center gap-2 text-xs bg-zinc-900/50 border border-white/5 rounded-md px-3 py-2">
                    <BellRing size={14} className={r.notified ? "text-zinc-500" : past ? "text-amber-400" : "text-sky-400"} />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${r.notified ? "text-zinc-400" : "text-zinc-100"}`}>{r.text}</div>
                      <div className="text-[11px] text-zinc-500">
                        {due.toLocaleString("pt-BR")} {r.notified ? "• notificado" : past ? "• pendente" : "• agendado"}
                      </div>
                    </div>
                    <button type="button" onClick={() => deleteReminder(r.id)} className="opacity-60 hover:opacity-100 p-1.5 rounded hover:bg-white/10 text-zinc-400" title="Remover">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
