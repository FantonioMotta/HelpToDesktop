import { useMemo, useState } from "react";
import { Pencil, Plus, Save, StickyNote, Trash2, X } from "lucide-react";
import { useAppData } from "../../store/AppDataContext";
import { ColorPicker } from "../../components/ColorPicker";
import { colorHex, dotStyle, type ColorKey } from "../../utils/colors";

export function NotesView() {
  const { notes, addNote, updateNote, deleteNote } = useAppData();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string>("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editColor, setEditColor] = useState<string>("none");

  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes]);

  const add = () => {
    if (!content.trim()) return;
    addNote({ title, content, color });
    setTitle("");
    setContent("");
    setColor("none");
  };

  const startEdit = (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    setEditingId(id);
    setEditTitle(n.title);
    setEditContent(n.content);
    setEditColor(n.color ?? "none");
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!editContent.trim()) return;
    updateNote(editingId, { title: editTitle, content: editContent, color: editColor });
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2"><StickyNote size={18} /> Notas</h2>
        <p className="text-xs text-zinc-400">Crie e organize suas notas (título opcional). As alterações são salvas automaticamente.</p>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-3">
        <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 space-y-2 h-fit">
          <div className="text-sm font-medium text-zinc-100">Nova nota</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            className="w-full bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva sua nota..."
            rows={8}
            className="w-full bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500/50 resize-none"
          />
          <ColorPicker value={color} onChange={(key: ColorKey) => setColor(key)} />
          <button type="button" onClick={add} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-600/80 hover:bg-sky-600 text-white text-xs">
            <Plus size={14} /> Salvar nota
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-3 space-y-3">
          <div className="text-sm font-medium text-zinc-100">Todas as notas ({notes.length})</div>
          <div className="space-y-2 max-h-[500px] overflow-auto pr-1">
            {sorted.length === 0 ? (
              <div className="text-sm text-zinc-500 py-6 text-center">Nenhuma nota encontrada.</div>
            ) : (
              sorted.map((n) => (
                <div
                  key={n.id}
                  className="border border-white/10 bg-zinc-900/50 rounded-lg p-3"
                  style={colorHex(n.color) ? { borderLeftColor: colorHex(n.color)!, borderLeftWidth: 3 } : undefined}
                >
                  {editingId === n.id ? (
                    <div className="space-y-2">
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título (opcional)" className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1 text-sm text-zinc-100 outline-none focus:border-sky-500/50" />
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1 text-xs text-zinc-100 outline-none focus:border-sky-500/50 resize-none" />
                      <ColorPicker value={editColor} onChange={(key: ColorKey) => setEditColor(key)} />
                      <div className="flex gap-2">
                        <button type="button" onClick={saveEdit} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs"><Save size={12} /> Salvar</button>
                        <button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-zinc-200 text-xs"><X size={12} /> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-100 truncate flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={dotStyle(n.color)} />
                            {n.title || "Sem título"}
                          </div>
                          <div className="text-[11px] text-zinc-500">{new Date(n.updatedAt).toLocaleString("pt-BR")}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => startEdit(n.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-300" title="Editar"><Pencil size={14} /></button>
                          <button type="button" onClick={() => deleteNote(n.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-400" title="Remover"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-zinc-300 whitespace-pre-wrap break-words">{n.content}</div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
