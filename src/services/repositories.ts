import type { CalendarEvent } from "../features/calendar/types";
import type { Note, Reminder, Task } from "../types/data";
import { openDatabase } from "./db";

type TaskRow = {
  id: string;
  title: string;
  done: number | boolean;
  created_at: number | string;
};

type NoteRow = {
  id: string;
  title: string;
  content: string;
  created_at: number | string;
  updated_at: number | string;
};

type ReminderRow = {
  id: string;
  text: string;
  due_at: number | string;
  created_at: number | string;
  notified: number | boolean;
};

type EventRow = {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: number | string;
};

const asNumber = (value: number | string): number => Number(value) || 0;
const asBoolean = (value: number | boolean): boolean => Number(value) === 1;

/**
 * Serializes writes so rapid actions (e.g. toggling a task twice) always reach
 * SQLite in the same order the UI applied them.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite(operation: () => Promise<void>): Promise<void> {
  const run = writeChain.then(operation, operation);
  writeChain = run.catch(() => undefined);
  return run;
}

export const tasksRepository = {
  async list(): Promise<Task[]> {
    const db = await openDatabase();
    if (!db) return [];
    const rows = await db.select<TaskRow[]>(
      "SELECT id, title, done, created_at FROM tasks ORDER BY created_at DESC",
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      done: asBoolean(row.done),
      createdAt: asNumber(row.created_at),
    }));
  },

  async save(task: Task): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute(
        `INSERT INTO tasks (id, title, done, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, done = excluded.done`,
        [task.id, task.title, task.done ? 1 : 0, task.createdAt],
      );
    });
  },

  async remove(id: string): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
    });
  },

  async removeCompleted(): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute("DELETE FROM tasks WHERE done = 1");
    });
  },
};

export const notesRepository = {
  async list(): Promise<Note[]> {
    const db = await openDatabase();
    if (!db) return [];
    const rows = await db.select<NoteRow[]>(
      "SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC",
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      createdAt: asNumber(row.created_at),
      updatedAt: asNumber(row.updated_at),
    }));
  },

  async save(note: Note): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute(
        `INSERT INTO notes (id, title, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           updated_at = excluded.updated_at`,
        [note.id, note.title, note.content, note.createdAt, note.updatedAt],
      );
    });
  },

  async remove(id: string): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute("DELETE FROM notes WHERE id = $1", [id]);
    });
  },
};

export const remindersRepository = {
  async list(): Promise<Reminder[]> {
    const db = await openDatabase();
    if (!db) return [];
    const rows = await db.select<ReminderRow[]>(
      "SELECT id, text, due_at, created_at, notified FROM reminders ORDER BY due_at ASC",
    );
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      dueAt: asNumber(row.due_at),
      createdAt: asNumber(row.created_at),
      notified: asBoolean(row.notified),
    }));
  },

  async save(reminder: Reminder): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute(
        `INSERT INTO reminders (id, text, due_at, created_at, notified)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET
           text = excluded.text,
           due_at = excluded.due_at,
           notified = excluded.notified`,
        [
          reminder.id,
          reminder.text,
          reminder.dueAt,
          reminder.createdAt,
          reminder.notified ? 1 : 0,
        ],
      );
    });
  },

  async remove(id: string): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute("DELETE FROM reminders WHERE id = $1", [id]);
    });
  },
};

export const eventsRepository = {
  async list(): Promise<CalendarEvent[]> {
    const db = await openDatabase();
    if (!db) return [];
    const rows = await db.select<EventRow[]>(
      `SELECT id, title, date, start_time, end_time, notes, created_at
       FROM events
       ORDER BY date ASC, start_time ASC`,
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      date: row.date,
      startTime: row.start_time ?? "",
      endTime: row.end_time ?? "",
      notes: row.notes ?? undefined,
    }));
  },

  async save(event: CalendarEvent): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute(
        `INSERT INTO events (id, title, date, start_time, end_time, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           date = excluded.date,
           start_time = excluded.start_time,
           end_time = excluded.end_time,
           notes = excluded.notes`,
        [
          event.id,
          event.title,
          event.date,
          event.startTime,
          event.endTime,
          event.notes ?? null,
          Date.now(),
        ],
      );
    });
  },

  async remove(id: string): Promise<void> {
    return enqueueWrite(async () => {
      const db = await openDatabase();
      if (!db) return;
      await db.execute("DELETE FROM events WHERE id = $1", [id]);
    });
  },
};

export type AppSnapshot = {
  tasks: Task[];
  notes: Note[];
  reminders: Reminder[];
  events: CalendarEvent[];
};

/** Loads every collection at once. Returns `null` outside Tauri (no SQLite). */
export async function loadSnapshot(): Promise<AppSnapshot | null> {
  const db = await openDatabase();
  if (!db) return null;
  const [tasks, notes, reminders, events] = await Promise.all([
    tasksRepository.list(),
    notesRepository.list(),
    remindersRepository.list(),
    eventsRepository.list(),
  ]);
  return { tasks, notes, reminders, events };
}
