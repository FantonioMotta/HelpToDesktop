import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppData } from "../../../store/AppDataContext";

export function QuickNotes() {
  const { notes, addNote, deleteNote } = useAppData();
  const [text, setText] = useState("");

  const recentNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);

  const add = () => {
    addNote({ content: text });
    setText("");
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 flex flex-col min-h-[140px]">
      <div className="text-sm font-medium text-zinc-100 mb-2">Notas rápidas</div>
      <div className="flex gap-2 mb-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Escreva uma nota..."
          className="flex-1 bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-sky-500/50"
        />
        <button type="button" onClick={add} className="p-1.5 rounded-md bg-white/10 hover:bg-white/15 text-zinc-100" title="Adicionar nota">
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-1 overflow-auto flex-1">
        {recentNotes.length === 0 ? (
          <div className="text-xs text-zinc-500">Nenhuma nota ainda.</div>
        ) : (
          recentNotes.map((n) => (
            <div key={n.id} className="group flex items-start gap-2 text-xs text-zinc-200 bg-zinc-900/50 rounded-md px-2 py-1.5">
              <span className="flex-1 break-words">{n.title && n.title !== n.content ? `${n.title}: ${n.content}` : n.content}</span>
              <button type="button" onClick={() => deleteNote(n.id)} className="opacity-60 hover:opacity-100 text-zinc-400" title="Remover">
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
