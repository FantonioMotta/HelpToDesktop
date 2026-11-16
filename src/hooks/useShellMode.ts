import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ShellMode, ShellModule } from "../types/shell";

export function useShellMode() {
  const [mode, setModeState] = useState<ShellMode>("compact");
  const [activeModule, setActiveModule] = useState<ShellModule>("dashboard");

  const applyMode = useCallback(async (next: ShellMode) => {
    setModeState(next);
    try {
      await invoke("set_shell_mode", { mode: next });
    } catch {
      // Running outside Tauri (e.g. plain browser preview) — ignore.
    }
  }, []);

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
                void invoke("set_shell_mode", { mode: "compact" }).catch(() => {});
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
  }, []);

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
