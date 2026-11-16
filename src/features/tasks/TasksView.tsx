import { useMemo, useState } from "react";
import { CheckSquare, Pencil, Plus, Trash2, X, Save } from "lucide-react";
import { useAppData } from "../../store/AppDataContext";

type Filter = "all" | "active" | "done";

export function TasksView() {
  const { tasks, addTask, updateTask, toggleTask, deleteTask, deleteCompletedTasks } = useAppData();
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmClearDone, setConfirmClearDone] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "active") return tasks.filter((t) => !t.done);
    if (filter === "done") return tasks.filter((t) => t.done);
    return tasks;
  }, [tasks, filter]);

  const counts = {
    all: tasks.length,
    active: tasks.filter((t) => !t.done).length,
    done: tasks.filter((t) => t.done).length,
  };

  const add = () => {
    addTask(text);
    setText("");
  };

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditingTitle(title);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const v = editingTitle.trim();
    if (v) updateTask(editingId, { title: v });
    setEditingId(null);
    setEditingTitle("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2"><CheckSquare size={18} /> Tarefas</h2>
          <p className="text-xs text-zinc-400">Gerencie suas tarefas. As alterações são salvas automaticamente.</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 space-y-3">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nova tarefa..."
            className="flex-1 bg-zinc-900/70 border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-sky-500/50"
          />
          <button type="button" onClick={add} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-sky-600/80 hover:bg-sky-600 text-white text-sm">
            <Plus size={15} /> Adicionar
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {([
              ["all", `Todas (${counts.all})`],
              ["active", `Ativas (${counts.active})`],
              ["done", `Concluídas (${counts.done})`],
            ] as [Filter, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`px-2.5 py-1.5 text-xs rounded-md ${filter === id ? "bg-white/15 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {counts.done > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearDone(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-red-300 hover:text-red-200 hover:bg-red-500/10 border border-red-500/20"
              title="Excluir todas as tarefas concluídas"
            >
              <Trash2 size={13} /> Excluir concluídas
            </button>
          )}
        </div>

        {confirmClearDone && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-center justify-between gap-3">
            <div className="text-xs text-red-100">Excluir todas as tarefas concluídas ({counts.done})? Esta ação não pode ser desfeita.</div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  deleteCompletedTasks();
                  setConfirmClearDone(false);
                }}
                className="px-2.5 py-1.5 text-xs rounded-md bg-red-600/80 hover:bg-red-600 text-white"
              >
                Excluir tudo
              </button>
              <button type="button" onClick={() => setConfirmClearDone(false)} className="px-2.5 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/15 text-zinc-200">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1 max-h-[420px] overflow-auto pr-1">
          {filtered.length === 0 ? (
            <div className="text-sm text-zinc-500 py-4 text-center">Nenhuma tarefa neste filtro.</div>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className="group flex items-center gap-2 bg-zinc-900/50 border border-white/5 rounded-md px-3 py-2">
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} className="accent-sky-500" />
                {editingId === t.id ? (
                  <>
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="flex-1 bg-zinc-800 border border-white/10 rounded px-2 py-1 text-sm text-zinc-100 outline-none focus:border-sky-500/50"
                      autoFocus
                    />
                    <button type="button" onClick={saveEdit} className="p-1.5 rounded hover:bg-white/10 text-emerald-400" title="Salvar"><Save size={14} /></button>
                    <button type="button" onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-white/10 text-zinc-400" title="Cancelar"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${t.done ? "line-through text-zinc-500" : "text-zinc-100"}`}>{t.title}</span>
                    <button type="button" onClick={() => startEdit(t.id, t.title)} className="opacity-60 hover:opacity-100 p-1.5 rounded hover:bg-white/10 text-zinc-300" title="Editar"><Pencil size={14} /></button>
                    <button type="button" onClick={() => deleteTask(t.id)} className="opacity-60 hover:opacity-100 p-1.5 rounded hover:bg-white/10 text-zinc-400" title="Remover"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
