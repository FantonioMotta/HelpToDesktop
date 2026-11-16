import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type VisualMode = "default" | "blend";
export type Anchor = "top-center" | "top-left" | "top-right";

export type Preferences = {
  allowMove: boolean;
  visualMode: VisualMode;
  anchor: Anchor;
  customPosition: { x: number; y: number } | null;
  launchAtStartup: boolean;
  globalShortcut: string;
  /** ATLAS voice assistant master switch. */
  atlasEnabled: boolean;
  /** Continuous listening for the "ATLAS" wake word (requires tiny model). */
  atlasWakeWord: boolean;
  /** Global push-to-talk shortcut (hold to talk). */
  atlasPttShortcut: string;
  /** Play short synthesized chimes for wake/success/error. */
  atlasSoundFeedback: boolean;
};

const DEFAULT_PREFS: Preferences = {
  allowMove: false,
  visualMode: "default",
  anchor: "top-center",
  customPosition: null,
  launchAtStartup: false,
  globalShortcut: "",
  atlasEnabled: true,
  atlasWakeWord: false,
  atlasPttShortcut: "Control+Alt+Space",
  atlasSoundFeedback: true,
};

const KEY = "helpbar.preferences.v1";

type Ctx = {
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => void;
  shortcutError: string | null;
  setShortcutError: (value: string | null) => void;
};

const PreferencesContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Preferences>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT_PREFS;
      const parsed = JSON.parse(raw) as Partial<Preferences>;
      return { ...DEFAULT_PREFS, ...parsed };
    } catch {
      return DEFAULT_PREFS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  const [shortcutError, setShortcutError] = useState<string | null>(null);

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefsState((p) => ({ ...p, ...patch }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({ prefs, setPrefs, shortcutError, setShortcutError }),
    [prefs, setPrefs, shortcutError],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
