import { describe, expect, it } from "vitest";
import { fold, parseAtlasCommand } from "./commandParser";

// Monday, 9 March 2026, 10:00 local time.
const NOW = new Date(2026, 2, 9, 10, 0, 0, 0);

function parse(text: string) {
  return parseAtlasCommand(text, NOW).intent;
}

describe("fold", () => {
  it("strips accents without changing length", () => {
    const input = "Amanhã, reunião às 9h — coração";
    expect(fold(input)).toHaveLength(input.length);
    expect(fold(input)).toBe("amanha, reuniao as 9h — coracao");
  });
});

describe("parseAtlasCommand — tasks", () => {
  it("creates a task after the wake word", () => {
    expect(parse("Atlas, criar tarefa comprar leite")).toEqual({
      kind: "create-task",
      title: "comprar leite",
    });
  });

  it("accepts 'nova tarefa' and keeps accents in the title", () => {
    expect(parse("nova tarefa ligar para o João")).toEqual({
      kind: "create-task",
      title: "ligar para o João",
    });
  });

  it("accepts a colon right after the keyword", () => {
    expect(parse("criar uma tarefa: revisar o relatório")).toEqual({
      kind: "create-task",
      title: "revisar o relatório",
    });
  });

  it("rejects an empty title", () => {
    const intent = parse("criar tarefa");
    expect(intent.kind).toBe("unsupported");
  });
});

describe("parseAtlasCommand — notes", () => {
  it("creates a note from 'anotar'", () => {
    expect(parse("Atlas, anotar ideia para o projeto HelpBar")).toEqual({
      kind: "create-note",
      content: "ideia para o projeto HelpBar",
    });
  });

  it("creates a note from 'nova nota'", () => {
    expect(parse("nova nota comprar café")).toEqual({
      kind: "create-note",
      content: "comprar café",
    });
  });
});

describe("parseAtlasCommand — reminders", () => {
  it("parses tomorrow at a spoken hour", () => {
    expect(parse("criar lembrete tomar remédio amanhã às 8")).toEqual({
      kind: "create-reminder",
      text: "tomar remédio",
      dueAt: new Date(2026, 2, 10, 8, 0).getTime(),
    });
  });

  it("parses 'lembrar de' with today and minutes", () => {
    expect(parse("me lembrar de pagar a conta hoje às 18:30")).toEqual({
      kind: "create-reminder",
      text: "pagar a conta",
      dueAt: new Date(2026, 2, 9, 18, 30).getTime(),
    });
  });

  it("rolls a past time to tomorrow when no date is given", () => {
    expect(parse("lembrete de beber água às 9")).toEqual({
      kind: "create-reminder",
      text: "beber água",
      dueAt: new Date(2026, 2, 10, 9, 0).getTime(),
    });
  });

  it("defaults to one hour from now without a schedule", () => {
    expect(parse("lembrar de alongar")).toEqual({
      kind: "create-reminder",
      text: "alongar",
      dueAt: NOW.getTime() + 60 * 60 * 1000,
    });
  });

  it("understands afternoon periods and word numbers", () => {
    expect(parse("lembrete de reunião hoje às três da tarde")).toEqual({
      kind: "create-reminder",
      text: "reunião",
      dueAt: new Date(2026, 2, 9, 15, 0).getTime(),
    });
  });
});

describe("parseAtlasCommand — events", () => {
  it("creates an event with date and default one-hour duration", () => {
    expect(parse("agendar reunião com equipe amanhã às 14")).toEqual({
      kind: "create-event",
      title: "reunião com equipe",
      date: "2026-03-10",
      startTime: "14:00",
      endTime: "15:00",
    });
  });

  it("parses an explicit time range", () => {
    expect(parse("criar evento dentista amanhã das 10 às 11:30")).toEqual({
      kind: "create-event",
      title: "dentista",
      date: "2026-03-10",
      startTime: "10:00",
      endTime: "11:30",
    });
  });

  it("resolves weekdays", () => {
    expect(parse("agendar almoço na sexta às 12:30")).toEqual({
      kind: "create-event",
      title: "almoço",
      date: "2026-03-13",
      startTime: "12:30",
      endTime: "13:30",
    });
  });

  it("parses explicit dates", () => {
    expect(parse("novo compromisso médico dia 20/03 às 9h")).toEqual({
      kind: "create-event",
      title: "médico",
      date: "2026-03-20",
      startTime: "09:00",
      endTime: "10:00",
    });
  });

  it("requires a date or time for events", () => {
    const intent = parse("criar evento sem data");
    expect(intent.kind).toBe("unsupported");
  });
});

describe("parseAtlasCommand — navigation and safety", () => {
  it("navigates to modules", () => {
    expect(parse("abrir o calendário")).toEqual({
      kind: "navigate",
      module: "calendar",
      label: "Calendário",
    });
    expect(parse("mostrar tarefas")).toEqual({
      kind: "navigate",
      module: "tasks",
      label: "Tarefas",
    });
    expect(parse("abrir configurações")).toEqual({
      kind: "navigate",
      module: "settings",
      label: "Configurações",
    });
  });

  it("routes agenda questions to the calendar", () => {
    expect(parse("o que eu tenho na agenda hoje")).toMatchObject({
      kind: "navigate",
      module: "calendar",
    });
  });

  it("refuses destructive commands", () => {
    const intent = parse("apagar tarefa comprar leite");
    expect(intent.kind).toBe("unsupported");
    if (intent.kind === "unsupported") {
      expect(intent.reason).toMatch(/destrutiv/i);
    }
  });

  it("returns empty for blank input", () => {
    expect(parse("   ")).toEqual({ kind: "empty" });
  });

  it("returns unsupported for unknown phrasing", () => {
    expect(parse("qual a previsão do tempo").kind).toBe("unsupported");
  });
});
