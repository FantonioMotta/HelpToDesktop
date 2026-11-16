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
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ShellModule } from "../../types/shell";
import { useAppData } from "../../store/AppDataContext";
import { usePreferences } from "../../store/PreferencesContext";
import {
  atlasApi,
  atlasAvailable,
  type AtlasErrorEvent,
  type AtlasFinalEvent,
  type AtlasModelProgressEvent,
  type AtlasModelsStatus,
  type AtlasRuntimeStatus,
  type AtlasStatusEvent,
} from "../../services/atlas";
import { applyHoldShortcut } from "../../services/globalShortcut";
import { parseAtlasCommand } from "./commandParser";
import { executeAtlasIntent, type AtlasActions, type AtlasUndo } from "./executor";
import { playAtlasChime } from "./feedback";

export type AtlasPhase = "idle" | "listening" | "processing" | "awake" | "success" | "error";

export type AtlasFeedback = {
  tone: "success" | "error" | "info";
  text: string;
};

export type AtlasHistoryEntry = {
  id: string;
  at: number;
  transcript: string;
  message: string;
  ok: boolean;
};

type AtlasContextValue = {
  phase: AtlasPhase;
  transcript: string;
  feedback: AtlasFeedback | null;
  history: AtlasHistoryEntry[];
  lastUndo: AtlasUndo | null;
  models: AtlasModelsStatus | null;
  modelsLoading: boolean;
  downloading: boolean;
  progress: AtlasModelProgressEvent | null;
  runtime: AtlasRuntimeStatus | null;
  shortcutError: string | null;
  available: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  toggleListening: () => Promise<void>;
  cancel: () => Promise<void>;
  undoLast: () => void;
  clearHistory: () => void;
  clearFeedback: () => void;
  refreshModels: () => Promise<void>;
  installModels: () => Promise<void>;
  removeModels: () => Promise<void>;
};

const AtlasContext = createContext<AtlasContextValue | null>(null);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function ensureWindowVisible(): Promise<void> {
  try {
    const win = getCurrentWindow();
    const visible = await win.isVisible();
    if (!visible) {
      await win.show();
      await win.unminimize();
    }
  } catch {
    // Outside Tauri
  }
}

export function AtlasProvider({ children }: { children: ReactNode }) {
  const { addTask, addNote, addReminder, addEvent, deleteTask, deleteNote, deleteReminder, deleteEvent } =
    useAppData();
  const { prefs } = usePreferences();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const [phase, setPhase] = useState<AtlasPhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<AtlasFeedback | null>(null);
  const [history, setHistory] = useState<AtlasHistoryEntry[]>([]);
  const [lastUndo, setLastUndoState] = useState<AtlasUndo | null>(null);
  const [models, setModels] = useState<AtlasModelsStatus | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<AtlasModelProgressEvent | null>(null);
  const [runtime, setRuntime] = useState<AtlasRuntimeStatus | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  const lastUndoRef = useRef<AtlasUndo | null>(null);
  const recordingRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);

  const setLastUndo = useCallback((undo: AtlasUndo | null) => {
    lastUndoRef.current = undo;
    setLastUndoState(undo);
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdle = useCallback(
    (delay: number) => {
      clearIdleTimer();
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        setPhase("idle");
      }, delay);
    },
    [clearIdleTimer],
  );

  const navigate = useCallback((module: ShellModule) => {
    window.dispatchEvent(new CustomEvent("helpbar:open-module", { detail: module }));
  }, []);

  const refreshModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const status = await atlasApi.modelsStatus();
      setModels(status);
    } catch (error) {
      console.error("[atlas] Falha ao consultar modelos:", error);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const refreshRuntime = useCallback(async () => {
    try {
      setRuntime(await atlasApi.runtimeStatus());
    } catch {
      // Outside Tauri
    }
  }, []);

  const handleFinal = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      clearIdleTimer();
      setTranscript(trimmed);

      if (!trimmed) {
        setFeedback({ tone: "error", text: "Não ouvi nada. Fale mais perto do microfone." });
        setPhase("error");
        if (prefsRef.current.atlasSoundFeedback) playAtlasChime("error");
        scheduleIdle(4000);
        return;
      }

      const parsed = parseAtlasCommand(trimmed);
      const actions: AtlasActions = {
        addTask,
        addNote,
        addReminder,
        addEvent,
        deleteTask,
        deleteNote,
        deleteReminder,
        deleteEvent,
        navigate,
      };
      const result = executeAtlasIntent(parsed.intent, actions);

      setHistory((prev) =>
        [
          {
            id: crypto.randomUUID(),
            at: Date.now(),
            transcript: trimmed,
            message: result.message,
            ok: result.ok,
          },
          ...prev,
        ].slice(0, 30),
      );
      setFeedback({ tone: result.ok ? "success" : "error", text: result.message });
      setLastUndo(result.undo ?? null);
      setPhase(result.ok ? "success" : "error");
      if (prefsRef.current.atlasSoundFeedback) {
        playAtlasChime(result.ok ? "success" : "error");
      }
      scheduleIdle(result.ok ? 6000 : 5000);
    },
    [
      addTask,
      addNote,
      addReminder,
      addEvent,
      deleteTask,
      deleteNote,
      deleteReminder,
      deleteEvent,
      navigate,
      setLastUndo,
      clearIdleTimer,
      scheduleIdle,
    ],
  );

  const startListening = useCallback(async () => {
    if (recordingRef.current) return;
    if (!atlasAvailable()) {
      setFeedback({ tone: "error", text: "A ATLAS só funciona no aplicativo desktop." });
      setPhase("error");
      scheduleIdle(4500);
      return;
    }
    clearIdleTimer();
    setFeedback(null);
    setLastUndo(null);
    setTranscript("");
    try {
      await ensureWindowVisible();
      await atlasApi.startPushToTalk();
      recordingRef.current = true;
      setPhase("listening");
      void refreshRuntime();
    } catch (error) {
      recordingRef.current = false;
      setPhase("error");
      setFeedback({ tone: "error", text: messageOf(error) });
      scheduleIdle(5000);
    }
  }, [clearIdleTimer, refreshRuntime, scheduleIdle, setLastUndo]);

  const stopListening = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    try {
      await atlasApi.stopPushToTalk();
      setPhase("processing");
      void refreshRuntime();
    } catch (error) {
      setPhase("error");
      setFeedback({ tone: "error", text: messageOf(error) });
      scheduleIdle(5000);
    }
  }, [refreshRuntime, scheduleIdle]);

  const toggleListening = useCallback(async () => {
    if (phase === "listening" || recordingRef.current) await stopListening();
    else await startListening();
  }, [phase, startListening, stopListening]);

  const cancel = useCallback(async () => {
    recordingRef.current = false;
    clearIdleTimer();
    try {
      await atlasApi.cancel();
    } catch {
      // ignore
    }
    setPhase("idle");
    setFeedback(null);
    void refreshRuntime();
  }, [clearIdleTimer, refreshRuntime]);

  const undoLast = useCallback(() => {
    const undo = lastUndoRef.current;
    if (!undo) return;
    setLastUndo(null);
    undo.run();
    setFeedback({ tone: "info", text: "Ação desfeita." });
    setPhase("idle");
    clearIdleTimer();
  }, [clearIdleTimer, setLastUndo]);

  const clearHistory = useCallback(() => setHistory([]), []);
  const clearFeedback = useCallback(() => {
    setFeedback(null);
    setPhase("idle");
    clearIdleTimer();
  }, [clearIdleTimer]);

  const installModels = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    setProgress(null);
    setFeedback(null);
    try {
      await atlasApi.downloadModels();
    } catch (error) {
      setDownloading(false);
      setFeedback({ tone: "error", text: `Falha ao baixar modelos: ${messageOf(error)}` });
    }
  }, [downloading]);

  const removeModels = useCallback(async () => {
    try {
      await atlasApi.deleteModels();
      await refreshModels();
      setFeedback({ tone: "info", text: "Modelos de voz removidos." });
    } catch (error) {
      setFeedback({ tone: "error", text: `Falha ao remover modelos: ${messageOf(error)}` });
    }
  }, [refreshModels]);

  // Initial status.
  useEffect(() => {
    if (!atlasAvailable()) return;
    void refreshModels();
    void refreshRuntime();
  }, [refreshModels, refreshRuntime]);

  // Native events.
  const finalRef = useRef(handleFinal);
  finalRef.current = handleFinal;
  const refreshModelsRef = useRef(refreshModels);
  refreshModelsRef.current = refreshModels;

  useEffect(() => {
    if (!atlasAvailable()) return;
    let disposed = false;
    const unlistens: Array<() => void> = [];

    (async () => {
      try {
        unlistens.push(
          await listen<AtlasStatusEvent>("atlas:status", (event) => {
            const { state, detail } = event.payload;
            if (state === "idle") {
              setPhase("idle");
              if (detail) setFeedback({ tone: "info", text: detail });
            } else if (state === "listening") {
              setPhase("listening");
            } else if (state === "processing") {
              setPhase("processing");
            } else if (state === "wake") {
              setPhase("awake");
              if (prefsRef.current.atlasSoundFeedback) playAtlasChime("wake");
            }
          }),
        );
        unlistens.push(
          await listen<AtlasFinalEvent>("atlas:final", (event) => {
            recordingRef.current = false;
            finalRef.current(event.payload.text);
          }),
        );
        unlistens.push(
          await listen<AtlasErrorEvent>("atlas:error", (event) => {
            recordingRef.current = false;
            setDownloading(false);
            setPhase("error");
            setFeedback({ tone: "error", text: event.payload.message });
            scheduleIdle(6000);
          }),
        );
        unlistens.push(
          await listen<AtlasModelProgressEvent>("atlas:model-progress", (event) => {
            setProgress(event.payload);
            if (event.payload.done) {
              void refreshModelsRef.current();
              if (event.payload.key === "all") setDownloading(false);
            }
          }),
        );
        unlistens.push(
          await listen<AtlasModelsStatus>("atlas:models-changed", (event) => {
            setModels(event.payload);
          }),
        );
        if (disposed) {
          for (const unlisten of unlistens) unlisten();
        }
      } catch {
        // Outside Tauri
      }
    })();

    return () => {
      disposed = true;
      for (const unlisten of unlistens) unlisten();
    };
  }, [scheduleIdle]);

  // Keep the wake word worker in sync with preferences and installed models.
  useEffect(() => {
    if (!atlasAvailable()) return;
    const enabled = prefs.atlasEnabled && prefs.atlasWakeWord && (models?.wakeReady ?? false);
    void atlasApi
      .setWakeWord(enabled)
      .then(() => refreshRuntime())
      .catch((error) => {
        if (enabled) {
          setFeedback({
            tone: "error",
            text: `Não foi possível ativar a palavra de ativação: ${messageOf(error)}`,
          });
        }
      });
  }, [prefs.atlasEnabled, prefs.atlasWakeWord, models?.wakeReady, refreshRuntime]);

  // Push-to-talk global shortcut (press and hold).
  const startRef = useRef(startListening);
  startRef.current = startListening;
  const stopRef = useRef(stopListening);
  stopRef.current = stopListening;

  useEffect(() => {
    if (!atlasAvailable()) return;
    if (!prefs.atlasEnabled) {
      void applyHoldShortcut("", { onPress: () => {} });
      setShortcutError(null);
      return;
    }
    const shortcut = prefs.atlasPttShortcut.trim();
    if (!shortcut) {
      void applyHoldShortcut("", { onPress: () => {} });
      setShortcutError(null);
      return;
    }
    let cancelled = false;
    void applyHoldShortcut(shortcut, {
      onPress: () => void startRef.current(),
      onRelease: () => void stopRef.current(),
    }).then((error) => {
      if (!cancelled) setShortcutError(error);
    });
    return () => {
      cancelled = true;
    };
  }, [prefs.atlasEnabled, prefs.atlasPttShortcut]);

  // Release the hold shortcut and stop the wake worker when the app closes.
  useEffect(() => {
    return () => {
      void applyHoldShortcut("", { onPress: () => {} });
      void atlasApi.setWakeWord(false).catch(() => {});
    };
  }, []);

  const value = useMemo<AtlasContextValue>(
    () => ({
      phase,
      transcript,
      feedback,
      history,
      lastUndo,
      models,
      modelsLoading,
      downloading,
      progress,
      runtime,
      shortcutError,
      available: atlasAvailable(),
      startListening,
      stopListening,
      toggleListening,
      cancel,
      undoLast,
      clearHistory,
      clearFeedback,
      refreshModels,
      installModels,
      removeModels,
    }),
    [
      phase,
      transcript,
      feedback,
      history,
      lastUndo,
      models,
      modelsLoading,
      downloading,
      progress,
      runtime,
      shortcutError,
      startListening,
      stopListening,
      toggleListening,
      cancel,
      undoLast,
      clearHistory,
      clearFeedback,
      refreshModels,
      installModels,
      removeModels,
    ],
  );

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas() {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error("useAtlas must be used within AtlasProvider");
  return ctx;
}
