import type { ShellModule } from "../../types/shell";

export type AtlasIntent =
  | { kind: "create-task"; title: string }
  | { kind: "create-note"; content: string }
  | { kind: "create-reminder"; text: string; dueAt: number }
  | {
      kind: "create-event";
      title: string;
      date: string;
      startTime: string;
      endTime: string;
    }
  | { kind: "navigate"; module: ShellModule; label: string }
  | { kind: "empty" }
  | { kind: "unsupported"; text: string; reason: string };

export type AtlasParseResult = {
  /** Text with the wake word and filler removed, useful for transcripts. */
  cleaned: string;
  intent: AtlasIntent;
};

const ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüçñ";
const PLAIN = "aaaaaeeeeiiiiooooouuuucn";

/**
 * Lower-cases and strips Portuguese accents **without changing string length**,
 * so match indexes still point at the original string.
 */
export function fold(text: string): string {
  const lower = text.toLowerCase();
  let out = "";
  for (const char of lower) {
    const index = ACCENTED.indexOf(char);
    out += index >= 0 ? PLAIN[index] : char;
  }
  return out;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const WORD_NUMBERS: Record<string, number> = {
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
};

type Range = [start: number, end: number];

type Schedule = {
  dateISO: string | null;
  time: string | null;
  endTime: string | null;
  ranges: Range[];
};

function weekdayDate(now: Date, weekday: number, forceNextWeek: boolean): Date {
  const today = startOfDay(now);
  let diff = (weekday - today.getDay() + 7) % 7;
  if (forceNextWeek && diff === 0) diff = 7;
  return addDays(today, diff);
}

function monthDayDate(now: Date, day: number, month: number, year?: number): Date | null {
  const today = startOfDay(now);
  const y = year ?? today.getFullYear();
  let candidate = new Date(y, month - 1, day);
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  // "dia 10" in the past means next month/year.
  if (!year && candidate.getTime() < today.getTime()) {
    candidate = new Date(y, month, day);
    if (candidate.getMonth() !== month || candidate.getDate() !== day) return null;
  }
  return candidate;
}

/** Extracts "hoje/amanhã/sexta/dia 12/03/2026" from the text and marks it consumed. */
function extractDate(folded: string, now: Date, ranges: Range[]): string | null {
  const relative: Array<[RegExp, number]> = [
    [/\bdepois de amanha\b/, 2],
    [/\bamanha\b/, 1],
    [/\bhoje\b/, 0],
  ];
  for (const [pattern, offset] of relative) {
    const match = pattern.exec(folded);
    if (match) {
      ranges.push([match.index, match.index + match[0].length]);
      return toISO(addDays(startOfDay(now), offset));
    }
  }

  const weekday =
    /\b(proxima|proximo)\s+(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/.exec(
      folded,
    ) ??
    /\b(?:nesta|neste|nessa|nesse|na|no)\s+(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/.exec(
      folded,
    );
  if (weekday) {
    const forced = weekday[1] === "proxima" || weekday[1] === "proximo";
    const name = forced ? weekday[2] : weekday[1];
    const target = WEEKDAYS[name];
    if (target !== undefined) {
      ranges.push([weekday.index, weekday.index + weekday[0].length]);
      return toISO(weekdayDate(now, target, forced));
    }
  }

  const fullDate = /\b(?:dia|em)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(folded);
  if (fullDate) {
    const day = parseInt(fullDate[1], 10);
    const month = parseInt(fullDate[2], 10);
    let year = fullDate[3] ? parseInt(fullDate[3], 10) : undefined;
    if (year !== undefined && year < 100) year += 2000;
    const date = monthDayDate(now, day, month, year);
    if (date) {
      ranges.push([fullDate.index, fullDate.index + fullDate[0].length]);
      return toISO(date);
    }
  }

  const dayOnly = /\b(?:dia)\s+(\d{1,2})\b/.exec(folded);
  if (dayOnly) {
    const day = parseInt(dayOnly[1], 10);
    const date = monthDayDate(now, day, now.getMonth() + 1);
    if (date) {
      ranges.push([dayOnly.index, dayOnly.index + dayOnly[0].length]);
      return toISO(date);
    }
  }

  return null;
}

type ParsedTime = { time: string | null; endTime: string | null; ranges: Range[] };

function validTime(hours: number, minutes: number): string | null {
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

function applyPeriod(hours: number, period: string | undefined): number {
  if (!period) return hours;
  if ((period === "tarde" || period === "noite") && hours < 12) return hours + 12;
  if (period === "madrugada" && hours === 12) return 0;
  return hours;
}

/** Extracts "às 8h30 / 14:00 / meio-dia / das 10 às 11" and marks it consumed. */
function extractTime(folded: string, ranges: Range[]): ParsedTime {
  const range =
    /\b(?:das?|de)\s+(\d{1,2})(?::(\d{2}))?\s*(?:h(?:oras?)?)?\s+(?:as|ate|a)\s+(\d{1,2})(?::(\d{2}))?\s*(?:h(?:oras?)?)?\b/.exec(
      folded,
    );
  if (range) {
    const start = validTime(
      parseInt(range[1], 10),
      range[2] ? parseInt(range[2], 10) : 0,
    );
    const end = validTime(parseInt(range[3], 10), range[4] ? parseInt(range[4], 10) : 0);
    if (start && end) {
      ranges.push([range.index, range.index + range[0].length]);
      return { time: start, endTime: end, ranges };
    }
  }

  const period =
    /\b(?:as|a|pelas|pela|para as|para a)\s+(\d{1,2})(?::(\d{2})|h\s*(\d{2})?(?:oras?)?)?(?:\s+(?:da|de)\s+(manha|tarde|noite|madrugada))?\b/.exec(
      folded,
    );
  if (period) {
    const hours = applyPeriod(parseInt(period[1], 10), period[4]);
    const minutes = period[2] ?? period[3] ?? "0";
    const time = validTime(hours, parseInt(minutes, 10));
    if (time) {
      ranges.push([period.index, period.index + period[0].length]);
      return { time, endTime: null, ranges };
    }
  }

  const word =
    /\b(?:as|a|pelas|pela|para as|para a)\s+(uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)(?:\s+(?:da|de)\s+(manha|tarde|noite|madrugada))?\b/.exec(
      folded,
    );
  if (word) {
    const hours = applyPeriod(WORD_NUMBERS[word[1]] ?? 0, word[2]);
    const time = validTime(hours, 0);
    if (time) {
      ranges.push([word.index, word.index + word[0].length]);
      return { time, endTime: null, ranges };
    }
  }

  const colon = /\b(\d{1,2}):(\d{2})\b/.exec(folded);
  if (colon) {
    const time = validTime(parseInt(colon[1], 10), parseInt(colon[2], 10));
    if (time) {
      ranges.push([colon.index, colon.index + colon[0].length]);
      return { time, endTime: null, ranges };
    }
  }

  const withH = /\b(\d{1,2})\s*h\s*(\d{2})?\b/.exec(folded);
  if (withH) {
    const time = validTime(parseInt(withH[1], 10), withH[2] ? parseInt(withH[2], 10) : 0);
    if (time) {
      ranges.push([withH.index, withH.index + withH[0].length]);
      return { time, endTime: null, ranges };
    }
  }

  const noon = /\b(?:ao\s+)?meio[- ]dia\b/.exec(folded);
  if (noon) {
    ranges.push([noon.index, noon.index + noon[0].length]);
    return { time: "12:00", endTime: null, ranges };
  }

  const midnight = /\b(?:a\s+)?meia[- ]noite\b/.exec(folded);
  if (midnight) {
    ranges.push([midnight.index, midnight.index + midnight[0].length]);
    return { time: "00:00", endTime: null, ranges };
  }

  return { time: null, endTime: null, ranges };
}

function removeRanges(text: string, ranges: Range[]): string {
  let out = text;
  for (const [start, end] of [...ranges].sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, start) + " " + out.slice(end);
  }
  return out;
}

function cleanTitle(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.\-–—]+/, "")
    .replace(/[\s,;:.\-–—]+$/, "")
    .replace(/^(?:de|do|da|para|que|me|o|a|os|as|chamado|chamada)\s+/i, "")
    .replace(/\s+(?:por favor|pfv)$/i, "")
    .trim();
}

function addHour(time: string): string {
  const [h, m] = time.split(":").map((part) => parseInt(part, 10));
  return `${pad((h + 1) % 24)}:${pad(m)}`;
}

function scheduleFor(text: string, folded: string, now: Date): { schedule: Schedule; title: string } {
  const ranges: Range[] = [];
  const dateISO = extractDate(folded, now, ranges);
  const { time, endTime } = extractTime(folded, ranges);
  return {
    schedule: { dateISO, time, endTime, ranges },
    title: cleanTitle(removeRanges(text, ranges)),
  };
}

function reminderDueAt(dateISO: string | null, time: string | null, now: Date): number {
  if (!dateISO && !time) return now.getTime() + 60 * 60 * 1000;

  if (dateISO && time) {
    const [y, m, d] = dateISO.split("-").map((part) => parseInt(part, 10));
    const [h, min] = time.split(":").map((part) => parseInt(part, 10));
    return new Date(y, m - 1, d, h, min).getTime();
  }

  if (dateISO) {
    const [y, m, d] = dateISO.split("-").map((part) => parseInt(part, 10));
    return new Date(y, m - 1, d, 9, 0).getTime();
  }

  const [h, min] = time!.split(":").map((part) => parseInt(part, 10));
  let candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
  if (candidate.getTime() <= now.getTime()) candidate = addDays(candidate, 1);
  return candidate.getTime();
}

const NAV_TARGETS: Array<{ pattern: RegExp; module: ShellModule; label: string }> = [
  { pattern: /^(?:abrir|mostrar|ir para|va para|ver|exibir)\s+(?:a\s+|o\s+|as\s+|os\s+)?(?:agenda|calendario)\b/, module: "calendar", label: "Calendário" },
  { pattern: /^(?:abrir|mostrar|ir para|va para|ver|exibir)\s+(?:as\s+|a\s+)?tarefas?\b/, module: "tasks", label: "Tarefas" },
  { pattern: /^(?:abrir|mostrar|ir para|va para|ver|exibir)\s+(?:as\s+|a\s+)?notas?\b/, module: "notes", label: "Notas" },
  { pattern: /^(?:abrir|mostrar|ir para|va para|ver|exibir)\s+(?:os\s+|o\s+)?lembretes?\b/, module: "reminders", label: "Lembretes" },
  { pattern: /^(?:abrir|mostrar|ir para|va para|ver|exibir)\s+(?:o\s+)?(?:dashboard|inicio)\b/, module: "dashboard", label: "Dashboard" },
  { pattern: /^(?:abrir|mostrar|ir para|va para|ver|exibir)\s+(?:as\s+|a\s+)?(?:configuracoes|ajustes|config)\b/, module: "settings", label: "Configurações" },
  { pattern: /^(?:abrir|mostrar|ir para|va para|ver|exibir)\s+(?:a\s+|o\s+)?atlas\b/, module: "atlas", label: "ATLAS" },
];

export function parseAtlasCommand(raw: string, now: Date = new Date()): AtlasParseResult {
  const original = raw.trim();
  if (!original) return { cleaned: "", intent: { kind: "empty" } };

  const foldedFull = fold(original);
  const wake = /^(?:(?:ei|oi|ola|ok|hey)\s+)?atlas\b[\s,.:;!\-–—]*/.exec(foldedFull);
  let text = wake ? original.slice(wake[0].length) : original;
  text = text.replace(/^\s*(?:por favor|pfv)\s+/i, "").trim();

  const folded = fold(text);
  if (!folded) return { cleaned: "", intent: { kind: "empty" } };

  if (/\b(?:apagar|apague|excluir|exclua|deletar|delete|remover|remova)\b/.test(folded)) {
    return {
      cleaned: text,
      intent: {
        kind: "unsupported",
        text,
        reason: "Comandos destrutivos ainda não são executados por voz.",
      },
    };
  }

  for (const target of NAV_TARGETS) {
    const match = target.pattern.exec(folded);
    if (match) {
      return {
        cleaned: text,
        intent: { kind: "navigate", module: target.module, label: target.label },
      };
    }
  }

  if (/\b(?:minhas?|quais|mostrar|ver)\b.*\btarefas?\b/.test(folded)) {
    return { cleaned: text, intent: { kind: "navigate", module: "tasks", label: "Tarefas" } };
  }
  if (/\b(?:agenda|compromissos)\b.*\b(?:hoje|amanha)?\b/.test(folded)) {
    return { cleaned: text, intent: { kind: "navigate", module: "calendar", label: "Calendário" } };
  }

  const notePrefix =
    /^(?:anotar|anota|anote|anotacao|fazer uma nota|criar (?:uma )?nota|nova nota|adicionar (?:uma )?nota|guardar (?:uma )?nota|salvar (?:uma )?nota)\b[\s,.:;\-–—]*/;
  const noteMatch = notePrefix.exec(folded);
  if (noteMatch) {
    const content = cleanTitle(text.slice(noteMatch[0].length));
    if (!content) {
      return { cleaned: text, intent: { kind: "unsupported", text, reason: "Não entendi o conteúdo da nota." } };
    }
    return { cleaned: text, intent: { kind: "create-note", content } };
  }

  const reminderPrefix =
    /^(?:(?:criar|adicionar|novo|nova|definir|programar|marcar|colocar)\s+(?:um\s+|uma\s+)?)?lembrete\b\s*(?:de\s+|para\s+|:\s*)?/;
  const rememberPrefix = /^(?:me\s+)?(?:lembrar|lembra|lembre)\b\s*(?:de\s+|para\s+|:\s*)?/;
  const warnPrefix = /^(?:me\s+)?avisar\b\s*(?:de\s+|para\s+|:\s*)?/;
  const reminderMatch = reminderPrefix.exec(folded) ?? rememberPrefix.exec(folded) ?? warnPrefix.exec(folded);
  if (reminderMatch) {
    const rest = text.slice(reminderMatch[0].length);
    const foldedRest = folded.slice(reminderMatch[0].length);
    const { schedule, title } = scheduleFor(rest, foldedRest, now);
    const body = title || "Lembrete";
    return {
      cleaned: text,
      intent: {
        kind: "create-reminder",
        text: body,
        dueAt: reminderDueAt(schedule.dateISO, schedule.time, now),
      },
    };
  }

  const eventPrefix =
    /^(?:(?:criar|adicionar|novo|nova|incluir|colocar)\s+(?:um\s+|uma\s+)?)?(?:evento|compromisso|reuniao|consulta)\b\s*(?:de\s+|para\s+|:\s*)?/;
  const schedulePrefix = /^(?:agendar|marcar|programar)\s+/;
  const eventMatch = eventPrefix.exec(folded);
  const scheduleMatch = eventMatch ? null : schedulePrefix.exec(folded);
  if (eventMatch || scheduleMatch) {
    const consumed = (eventMatch ?? scheduleMatch)![0].length;
    const rest = text.slice(consumed);
    const foldedRest = folded.slice(consumed);
    const { schedule, title } = scheduleFor(rest, foldedRest, now);
    if (!schedule.dateISO && !schedule.time) {
      return {
        cleaned: text,
        intent: {
          kind: "unsupported",
          text,
          reason: "Diga quando: por exemplo “agendar reunião amanhã às 14h”.",
        },
      };
    }
    const date = schedule.dateISO ?? toISO(now);
    const startTime = schedule.time ?? "";
    const endTime = schedule.endTime ?? (startTime ? addHour(startTime) : "");
    const eventTitle = title || "Compromisso";
    return {
      cleaned: text,
      intent: {
        kind: "create-event",
        title: eventTitle,
        date,
        startTime,
        endTime,
      },
    };
  }

  const taskPrefix =
    /^(?:(?:criar|adicionar|incluir|colocar|nova|novo|registrar)\s+(?:uma\s+|um\s+)?|(?:uma|um)\s+)?(?:tarefa|tarefinha)\b\s*(?:de\s+|para\s+|:\s*)?/;
  const todoPrefix = /^(?:tenho que|preciso|devo)\s+/;
  const taskMatch = taskPrefix.exec(folded);
  const todoMatch = taskMatch ? null : todoPrefix.exec(folded);
  if (taskMatch || todoMatch) {
    const consumed = (taskMatch ?? todoMatch)![0].length;
    const category = /^(?:pessoal|trabalho|casa|estudos?)\b[\s,:-]*/.exec(folded.slice(consumed));
    const extra = category ? category[0].length : 0;
    const title = cleanTitle(text.slice(consumed + extra));
    if (!title) {
      return { cleaned: text, intent: { kind: "unsupported", text, reason: "Não entendi o título da tarefa." } };
    }
    return { cleaned: text, intent: { kind: "create-task", title } };
  }

  return {
    cleaned: text,
    intent: {
      kind: "unsupported",
      text,
      reason:
        "Não reconheci o comando. Tente “criar tarefa…”, “anotar…”, “lembrar de…” ou “agendar… amanhã às 9h”.",
    },
  };
}
