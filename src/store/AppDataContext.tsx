import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CalendarEvent } from "../features/calendar/types";
import type { Note, Reminder, Task } from "../types/data";
import {
  eventsRepository,
  loadSnapshot,
  notesRepository,
  remindersRepository,
  tasksRepository,
} from "../services/repositories";

export type StorageStatus = {
  /** Initial load from SQLite has finished (successfully or not). */
  ready: boolean;
  /** Data is being written to SQLite. False means session-only fallback. */
  persistent: boolean;
  error: string | null;
};

type NewEvent = Omit<CalendarEvent, "id">;

type AppDataContextValue = {
  tasks: Task[];
  notes: Note[];
  reminders: Reminder[];
  events: CalendarEvent[];
  storage: StorageStatus;
  addTask: (title: string) => string | null;
  updateTask: (id: string, patch: Partial<Pick<Task, "title" | "done">>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteCompletedTasks: () => void;
  addNote: (input: { title?: string; content: string; color?: string }) => string | null;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "content" | "color">>) => void;
  deleteNote: (id: string) => void;
  addReminder: (input: { text: string; dueAt: number }) => string | null;
  updateReminder: (id: string, patch: Partial<Pick<Reminder, "text" | "dueAt" | "notified">>) => void;
  deleteReminder: (id: string) => void;
  markReminderNotified: (id: string) => void;
  addEvent: (input: NewEvent) => string | null;
  updateEvent: (id: string, patch: Partial<NewEvent>) => void;
  deleteEvent: (id: string) => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [storage, setStorage] = useState<StorageStatus>({
    ready: false,
    persistent: false,
    error: null,
  });

  // Refs mirror the latest state so event handlers can compute the next value
  // synchronously without depending on a possibly stale render closure.
  const tasksRef = useRef<Task[]>([]);
  const notesRef = useRef<Note[]>([]);
  const remindersRef = useRef<Reminder[]>([]);
  const eventsRef = useRef<CalendarEvent[]>([]);

  const commitTasks = useCallback((next: Task[]) => {
    tasksRef.current = next;
    setTasks(next);
  }, []);
  const commitNotes = useCallback((next: Note[]) => {
    notesRef.current = next;
    setNotes(next);
  }, []);
  const commitReminders = useCallback((next: Reminder[]) => {
    remindersRef.current = next;
    setReminders(next);
  }, []);
  const commitEvents = useCallback((next: CalendarEvent[]) => {
    eventsRef.current = next;
    setEvents(next);
  }, []);

  const reportWriteError = useCallback((action: string, error: unknown) => {
    console.error(`[db] Falha ao ${action}:`, error);
    setStorage((prev) =>
      prev.error
        ? prev
        : { ...prev, persistent: false, error: `${action}: ${errorMessage(error)}` },
    );
  }, []);

  const persist = useCallback(
    (action: string, operation: Promise<void>) => {
      void operation.catch((error) => reportWriteError(action, error));
    },
    [reportWriteError],
  );

  // Initial load from SQLite.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await loadSnapshot();
        if (cancelled) return;
        if (snapshot) {
          commitTasks(snapshot.tasks);
          commitNotes(snapshot.notes);
          commitReminders(snapshot.reminders);
          commitEvents(snapshot.events);
          setStorage({ ready: true, persistent: true, error: null });
        } else {
          setStorage({ ready: true, persistent: false, error: null });
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[db] Falha ao carregar dados locais:", error);
        setStorage({ ready: true, persistent: false, error: errorMessage(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commitTasks, commitNotes, commitReminders, commitEvents]);

  const addTask = useCallback(
    (title: string) => {
      const value = title.trim();
      if (!value) return null;
      const task: Task = {
        id: crypto.randomUUID(),
        title: value,
        done: false,
        createdAt: Date.now(),
      };
      commitTasks([task, ...tasksRef.current]);
      persist("salvar tarefa", tasksRepository.save(task));
      return task.id;
    },
    [commitTasks, persist],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Pick<Task, "title" | "done">>) => {
      const current = tasksRef.current.find((task) => task.id === id);
      if (!current) return;
      const next: Task = {
        ...current,
        ...patch,
        title: patch.title !== undefined ? patch.title.trim() || current.title : current.title,
      };
      commitTasks(tasksRef.current.map((task) => (task.id === id ? next : task)));
      persist("atualizar tarefa", tasksRepository.save(next));
    },
    [commitTasks, persist],
  );

  const toggleTask = useCallback(
    (id: string) => {
      const current = tasksRef.current.find((task) => task.id === id);
      if (!current) return;
      const next: Task = { ...current, done: !current.done };
      commitTasks(tasksRef.current.map((task) => (task.id === id ? next : task)));
      persist("atualizar tarefa", tasksRepository.save(next));
    },
    [commitTasks, persist],
  );

  const deleteTask = useCallback(
    (id: string) => {
      commitTasks(tasksRef.current.filter((task) => task.id !== id));
      persist("excluir tarefa", tasksRepository.remove(id));
    },
    [commitTasks, persist],
  );

  const deleteCompletedTasks = useCallback(() => {
    commitTasks(tasksRef.current.filter((task) => !task.done));
    persist("excluir tarefas concluídas", tasksRepository.removeCompleted());
  }, [commitTasks, persist]);

  const addNote = useCallback(
    ({ title, content, color }: { title?: string; content: string; color?: string }) => {
      const body = content.trim();
      if (!body) return null;
      const now = Date.now();
      const heading = (title ?? "").trim();
      const note: Note = {
        id: crypto.randomUUID(),
        title: heading || (body.length > 40 ? `${body.slice(0, 40)}…` : body),
        content: body,
        color: color ?? "none",
        createdAt: now,
        updatedAt: now,
      };
      commitNotes([note, ...notesRef.current]);
      persist("salvar nota", notesRepository.save(note));
      return note.id;
    },
    [commitNotes, persist],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, "title" | "content" | "color">>) => {
      const current = notesRef.current.find((note) => note.id === id);
      if (!current) return;
      const next: Note = {
        ...current,
        ...patch,
        title: patch.title !== undefined ? patch.title.trim() || current.title : current.title,
        content: patch.content !== undefined ? patch.content : current.content,
        updatedAt: Date.now(),
      };
      commitNotes(notesRef.current.map((note) => (note.id === id ? next : note)));
      persist("atualizar nota", notesRepository.save(next));
    },
    [commitNotes, persist],
  );

  const deleteNote = useCallback(
    (id: string) => {
      commitNotes(notesRef.current.filter((note) => note.id !== id));
      persist("excluir nota", notesRepository.remove(id));
    },
    [commitNotes, persist],
  );

  const addReminder = useCallback(
    ({ text, dueAt }: { text: string; dueAt: number }) => {
      const body = text.trim();
      if (!body || !Number.isFinite(dueAt)) return null;
      const reminder: Reminder = {
        id: crypto.randomUUID(),
        text: body,
        dueAt,
        createdAt: Date.now(),
        notified: false,
      };
      commitReminders([reminder, ...remindersRef.current]);
      persist("salvar lembrete", remindersRepository.save(reminder));
      return reminder.id;
    },
    [commitReminders, persist],
  );

  const updateReminder = useCallback(
    (id: string, patch: Partial<Pick<Reminder, "text" | "dueAt" | "notified">>) => {
      const current = remindersRef.current.find((reminder) => reminder.id === id);
      if (!current) return;
      const next: Reminder = {
        ...current,
        ...patch,
        text: patch.text !== undefined ? patch.text.trim() || current.text : current.text,
      };
      commitReminders(remindersRef.current.map((reminder) => (reminder.id === id ? next : reminder)));
      persist("atualizar lembrete", remindersRepository.save(next));
    },
    [commitReminders, persist],
  );

  const deleteReminder = useCallback(
    (id: string) => {
      commitReminders(remindersRef.current.filter((reminder) => reminder.id !== id));
      persist("excluir lembrete", remindersRepository.remove(id));
    },
    [commitReminders, persist],
  );

  const markReminderNotified = useCallback(
    (id: string) => {
      const current = remindersRef.current.find((reminder) => reminder.id === id);
      if (!current || current.notified) return;
      const next: Reminder = { ...current, notified: true };
      commitReminders(
        remindersRef.current.map((reminder) => (reminder.id === id ? next : reminder)),
      );
      persist("atualizar lembrete", remindersRepository.save(next));
    },
    [commitReminders, persist],
  );

  const addEvent = useCallback(
    (input: NewEvent) => {
      const event: CalendarEvent = { ...input, id: crypto.randomUUID() };
      commitEvents([event, ...eventsRef.current]);
      persist("salvar compromisso", eventsRepository.save(event));
      return event.id;
    },
    [commitEvents, persist],
  );

  const updateEvent = useCallback(
    (id: string, patch: Partial<NewEvent>) => {
      const current = eventsRef.current.find((event) => event.id === id);
      if (!current) return;
      const next: CalendarEvent = { ...current, ...patch };
      commitEvents(eventsRef.current.map((event) => (event.id === id ? next : event)));
      persist("atualizar compromisso", eventsRepository.save(next));
    },
    [commitEvents, persist],
  );

  const deleteEvent = useCallback(
    (id: string) => {
      commitEvents(eventsRef.current.filter((event) => event.id !== id));
      persist("excluir compromisso", eventsRepository.remove(id));
    },
    [commitEvents, persist],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      tasks,
      notes,
      reminders,
      events,
      storage,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      deleteCompletedTasks,
      addNote,
      updateNote,
      deleteNote,
      addReminder,
      updateReminder,
      deleteReminder,
      markReminderNotified,
      addEvent,
      updateEvent,
      deleteEvent,
    }),
    [
      tasks,
      notes,
      reminders,
      events,
      storage,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      deleteCompletedTasks,
      addNote,
      updateNote,
      deleteNote,
      addReminder,
      updateReminder,
      deleteReminder,
      markReminderNotified,
      addEvent,
      updateEvent,
      deleteEvent,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
