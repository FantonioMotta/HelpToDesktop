import { describe, expect, it, vi } from "vitest";
import { executeAtlasIntent, type AtlasActions } from "./executor";

const NOW = new Date(2026, 2, 9, 10, 0, 0, 0);

function makeActions() {
  const removed: string[] = [];
  const navigate = vi.fn();
  let counter = 0;
  const actions: AtlasActions = {
    addTask: vi.fn(() => `task-${++counter}`),
    addNote: vi.fn(() => `note-${++counter}`),
    addReminder: vi.fn(() => `reminder-${++counter}`),
    addEvent: vi.fn(() => `event-${++counter}`),
    deleteTask: vi.fn((id: string) => removed.push(`task:${id}`)),
    deleteNote: vi.fn((id: string) => removed.push(`note:${id}`)),
    deleteReminder: vi.fn((id: string) => removed.push(`reminder:${id}`)),
    deleteEvent: vi.fn((id: string) => removed.push(`event:${id}`)),
    navigate,
  };
  return { actions, removed, navigate };
}

describe("executeAtlasIntent", () => {
  it("creates a task and supports undo", () => {
    const { actions, removed } = makeActions();
    const result = executeAtlasIntent({ kind: "create-task", title: "comprar leite" }, actions, NOW);

    expect(actions.addTask).toHaveBeenCalledWith("comprar leite");
    expect(result).toMatchObject({ ok: true, message: "Tarefa criada: comprar leite" });
    expect(result.undo?.description).toContain("comprar leite");

    result.undo?.run();
    expect(removed).toEqual(["task:task-1"]);
  });

  it("creates a reminder with a friendly schedule label", () => {
    const { actions } = makeActions();
    const result = executeAtlasIntent(
      {
        kind: "create-reminder",
        text: "tomar remédio",
        dueAt: new Date(2026, 2, 10, 8, 0).getTime(),
      },
      actions,
      NOW,
    );

    expect(actions.addReminder).toHaveBeenCalledWith({
      text: "tomar remédio",
      dueAt: new Date(2026, 2, 10, 8, 0).getTime(),
    });
    expect(result.message).toBe("Lembrete para amanhã às 08:00: tomar remédio");
  });

  it("creates an event and navigates", () => {
    const { actions, navigate } = makeActions();
    const event = executeAtlasIntent(
      {
        kind: "create-event",
        title: "reunião",
        date: "2026-03-10",
        startTime: "14:00",
        endTime: "15:00",
      },
      actions,
      NOW,
    );
    expect(event.message).toBe("Compromisso amanhã às 14:00: reunião");

    const nav = executeAtlasIntent({ kind: "navigate", module: "tasks", label: "Tarefas" }, actions, NOW);
    expect(navok(nav)).toBe(true);
    expect(navigate).toHaveBeenCalledWith("tasks");
  });

  it("reports unsupported and empty intents", () => {
    const { actions } = makeActions();
    expect(
      executeAtlasIntent({ kind: "unsupported", text: "x", reason: "Sem suporte." }, actions, NOW),
    ).toMatchObject({ ok: false, message: "Sem suporte." });
    expect(executeAtlasIntent({ kind: "empty" }, actions, NOW).ok).toBe(false);
  });
});

function navok(result: { ok: boolean }): boolean {
  return result.ok;
}
