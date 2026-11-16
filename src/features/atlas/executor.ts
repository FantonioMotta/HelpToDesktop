import type { ShellModule } from "../../types/shell";
import type { AtlasIntent } from "./commandParser";

export type AtlasActions = {
  addTask: (title: string) => string | null;
  addNote: (input: { title?: string; content: string }) => string | null;
  addReminder: (input: { text: string; dueAt: number }) => string | null;
  addEvent: (input: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }) => string | null;
  deleteTask: (id: string) => void;
  deleteNote: (id: string) => void;
  deleteReminder: (id: string) => void;
  deleteEvent: (id: string) => void;
  navigate: (module: ShellModule) => void;
  notify?: (title: string, body: string) => void;
};

export type AtlasUndo = {
  label: string;
  description: string;
  run: () => void;
};

export type AtlasExecution = {
  ok: boolean;
  message: string;
  undo?: AtlasUndo;
  module?: ShellModule;
};

function shorten(text: string, max = 64): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function dateParts(iso: string): { day: number; month: number; year: number } {
  const [year, month, day] = iso.split("-").map((part) => parseInt(part, 10));
  return { day, month, year };
}

function dateLabel(iso: string, now: Date): string {
  const { day, month, year } = dateParts(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(year, month - 1, day);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function reminderLabel(dueAt: number, now: Date): string {
  const due = new Date(dueAt);
  const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(
    due.getDate(),
  ).padStart(2, "0")}`;
  const time = `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
  return `${dateLabel(iso, now)} às ${time}`;
}

/** Turns a parsed intent into a store mutation and human-readable feedback. */
export function executeAtlasIntent(
  intent: AtlasIntent,
  actions: AtlasActions,
  now: Date = new Date(),
): AtlasExecution {
  switch (intent.kind) {
    case "create-task": {
      const id = actions.addTask(intent.title);
      if (!id) return { ok: false, message: "Não consegui criar a tarefa." };
      return {
        ok: true,
        message: `Tarefa criada: ${shorten(intent.title)}`,
        undo: {
          label: "Desfazer",
          description: `Remover a tarefa “${shorten(intent.title)}”`,
          run: () => actions.deleteTask(id),
        },
      };
    }

    case "create-note": {
      const id = actions.addNote({ content: intent.content });
      if (!id) return { ok: false, message: "Não consegui criar a nota." };
      return {
        ok: true,
        message: `Nota salva: ${shorten(intent.content)}`,
        undo: {
          label: "Desfazer",
          description: `Remover a nota “${shorten(intent.content)}”`,
          run: () => actions.deleteNote(id),
        },
      };
    }

    case "create-reminder": {
      const id = actions.addReminder({ text: intent.text, dueAt: intent.dueAt });
      if (!id) return { ok: false, message: "Não consegui criar o lembrete." };
      const when = reminderLabel(intent.dueAt, now);
      return {
        ok: true,
        message: `Lembrete para ${when}: ${shorten(intent.text)}`,
        undo: {
          label: "Desfazer",
          description: `Remover o lembrete “${shorten(intent.text)}”`,
          run: () => actions.deleteReminder(id),
        },
      };
    }

    case "create-event": {
      const id = actions.addEvent({
        title: intent.title,
        date: intent.date,
        startTime: intent.startTime,
        endTime: intent.endTime,
      });
      if (!id) return { ok: false, message: "Não consegui criar o compromisso." };
      const when = intent.startTime
        ? `${dateLabel(intent.date, now)} às ${intent.startTime}`
        : dateLabel(intent.date, now);
      return {
        ok: true,
        message: `Compromisso ${when}: ${shorten(intent.title)}`,
        undo: {
          label: "Desfazer",
          description: `Remover o compromisso “${shorten(intent.title)}”`,
          run: () => actions.deleteEvent(id),
        },
      };
    }

    case "navigate": {
      actions.navigate(intent.module);
      return { ok: true, message: `Abrindo ${intent.label}`, module: intent.module };
    }

    case "empty":
      return { ok: false, message: "Não ouvi nada. Tente falar mais perto do microfone." };

    case "unsupported":
      return { ok: false, message: intent.reason };
  }
}
