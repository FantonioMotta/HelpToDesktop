import { BellRing, Trash2 } from "lucide-react";
import { useAppData } from "../../../store/AppDataContext";

export function RemindersList() {
  const { reminders, deleteReminder } = useAppData();
  const upcoming = [...reminders].sort((a, b) => a.dueAt - b.dueAt).slice(0, 6);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 flex flex-col min-h-[140px]">
      <div className="text-sm font-medium text-zinc-100 mb-1">Lembretes</div>
      <div className="text-[11px] text-zinc-500 mb-2">Agende no módulo Lembretes.</div>
      <div className="space-y-1 overflow-auto flex-1">
        {upcoming.length === 0 ? (
          <div className="text-xs text-zinc-500">Nenhum lembrete ainda.</div>
        ) : (
          upcoming.map((it) => {
            const due = new Date(it.dueAt);
            return (
              <div key={it.id} className="group flex items-center gap-2 text-xs text-zinc-200 bg-zinc-900/50 rounded-md px-2 py-1.5">
                <BellRing size={12} className={it.notified ? "text-zinc-500" : "text-amber-400"} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{it.text}</div>
                  <div className="text-[10px] text-zinc-500">{due.toLocaleString("pt-BR")}</div>
                </div>
                <button type="button" onClick={() => deleteReminder(it.id)} className="opacity-60 hover:opacity-100 text-zinc-400" title="Remover lembrete">
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
