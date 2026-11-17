import { useEffect, useState } from "react";
import { Keyboard, Trash2 } from "lucide-react";
import {
  resumeGlobalShortcut,
  resumeHoldShortcut,
  shortcutDisplay,
  suspendGlobalShortcut,
  suspendHoldShortcut,
} from "../../services/globalShortcut";

const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

const SIMPLE_KEYS: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backquote: "Backquote",
  Minus: "Minus",
  Equal: "Equal",
  BracketLeft: "BracketLeft",
  BracketRight: "BracketRight",
  Backslash: "Backslash",
  Semicolon: "Semicolon",
  Quote: "Quote",
  Comma: "Comma",
  Period: "Period",
  Slash: "Slash",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Insert: "Insert",
  Delete: "Delete",
  PrintScreen: "PrintScreen",
  ScrollLock: "ScrollLock",
  Pause: "Pause",
  CapsLock: "CapsLock",
};

function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code;
  if (/^Digit[0-9]$/.test(code)) return code;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return SIMPLE_KEYS[code] ?? null;
}

export function ShortcutRecorder({
  value,
  onChange,
  kind = "global",
}: {
  value: string;
  onChange: (shortcut: string) => void;
  kind?: "global" | "atlas";
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspend = kind === "atlas" ? suspendHoldShortcut : suspendGlobalShortcut;
  const resume = kind === "atlas" ? resumeHoldShortcut : resumeGlobalShortcut;

  // Release the currently registered shortcut while recording so the same
  // combination can be captured again.
  useEffect(() => {
    if (!recording) return;
    void suspend();
    return () => {
      void resume();
    };
  }, [recording, suspend, resume]);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        setError(null);
        return;
      }
      if (e.code === "Backspace" || e.code === "Delete") {
        onChange("");
        setRecording(false);
        setError(null);
        return;
      }
      if (MODIFIER_CODES.has(e.code)) return;

      const key = keyFromCode(e.code);
      if (!key) {
        setError("Tecla não suportada para atalho global.");
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Super");

      const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(key);
      if (parts.length === 0 && !isFunctionKey) {
        setError("Use Ctrl, Alt, Shift ou Win como modificador (exceto F1–F24).");
        return;
      }

      onChange([...parts, key].join("+"));
      setRecording(false);
      setError(null);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setRecording((r) => !r);
            setError(null);
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
            recording
              ? "bg-sky-600/80 border-sky-500/50 text-white animate-pulse"
              : "bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
          }`}
          title="Clique e pressione a combinação desejada"
        >
          <Keyboard size={14} />
          {recording ? "Pressione a combinação…" : shortcutDisplay(value)}
        </button>
        {value && !recording && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/10"
            title="Remover atalho"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {error && <span className="text-[11px] text-red-400 max-w-[320px] text-right">{error}</span>}
      {recording && (
        <span className="text-[11px] text-zinc-500 max-w-[320px] text-right">
          Esc cancela • Backspace/Delete remove o atalho
        </span>
      )}
    </div>
  );
}
