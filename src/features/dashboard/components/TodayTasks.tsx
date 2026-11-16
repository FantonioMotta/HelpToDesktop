import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppData } from "../../../store/AppDataContext";

export function TodayTasks() {
  const { tasks, addTask, toggleTask, deleteTask } = useAppData();
  const [text, setText] = useState("");

  const add = () => {
    addTask(text);
    setText("");
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 flex flex-col min-h-[140px]">
      <div className="text-sm font-medium text-zinc-100 mb-2">Tarefas do dia</div>
      <div className="flex gap-2 mb-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nova tarefa..."
          className="flex-1 bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-sky-500/50"
        />
        <button type="button" onClick={add} className="p-1.5 rounded-md bg-white/10 hover:bg-white/15 text-zinc-100" title="Adicionar tarefa">
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-1 overflow-auto flex-1">
        {tasks.length === 0 ? (
          <div className="text-xs text-zinc-500">Nenhuma tarefa ainda.</div>
        ) : (
          tasks.slice(0, 8).map((t) => (
            <div key={t.id} className="group flex items-center gap-2 text-xs text-zinc-200 bg-zinc-900/50 rounded-md px-2 py-1.5">
              <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} className="accent-sky-500" />
                <span className={`truncate ${t.done ? "line-through text-zinc-500" : ""}`}>{t.title}</span>
              </label>
              <button type="button" onClick={() => deleteTask(t.id)} className="opacity-60 hover:opacity-100 text-zinc-400" title="Remover tarefa">
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
