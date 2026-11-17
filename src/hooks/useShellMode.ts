import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ShellMode, ShellModule } from "../types/shell";
import { usePreferences } from "../store/PreferencesContext";

export function useShellMode() {
  const [mode, setModeState] = useState<ShellMode>("compact");
  const [activeModule, setActiveModule] = useState<ShellModule>("dashboard");
  const { prefs } = usePreferences();

  const invokeMode = useCallback(async (next: ShellMode) => {
    // Pass the saved position so Rust doesn't snap the window back to the
    // primary monitor when the size changes between compact/expanded.
    const customPosition = prefs.allowMove && prefs.customPosition
      ? [prefs.customPosition.x, prefs.customPosition.y]
      : null;
    await invoke("set_shell_mode", { mode: next, customPosition });
  }, [prefs.allowMove, prefs.customPosition]);

  const applyMode = useCallback(async (next: ShellMode) => {
    setModeState(next);
    try {
      await invokeMode(next);
    } catch {
      // Running outside Tauri (e.g. plain browser preview) — ignore.
    }
  }, [invokeMode]);

  const expand = useCallback(async () => {
    await applyMode("expanded");
    try {
      await getCurrentWindow().setFocus();
    } catch {
      // Outside Tauri
    }
  }, [applyMode]);

  const collapse = useCallback(() => {
    void applyMode("compact");
  }, [applyMode]);

  const togglePin = useCallback(() => {
    void applyMode(mode === "focus" ? "expanded" : "focus");
  }, [applyMode, mode]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const win = getCurrentWindow();
        unlisten = await win.onFocusChanged(({ payload: focused }) => {
          if (!focused) {
            setModeState((current) => {
              if (current === "expanded") {
                const customPosition = prefs.allowMove && prefs.customPosition
                  ? [prefs.customPosition.x, prefs.customPosition.y]
                  : null;
                void invoke("set_shell_mode", { mode: "compact", customPosition }).catch(() => {});
                return "compact";
              }
              return current;
            });
          }
        });
      } catch {
        // Outside Tauri
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, [prefs.allowMove, prefs.customPosition]);

  return {
    mode,
    activeModule,
    setActiveModule,
    expand,
    collapse,
    togglePin,
    isPinned: mode === "focus",
    isOpen: mode === "expanded" || mode === "focus",
  };
}
