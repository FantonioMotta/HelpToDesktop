import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { applyGlobalShortcut } from "../services/globalShortcut";
import { usePreferences } from "../store/PreferencesContext";

async function toggleHelpBar() {
  try {
    const win = getCurrentWindow();
    const visible = await win.isVisible();
    if (!visible) {
      await win.show();
      await win.unminimize();
      await win.setFocus();
      window.dispatchEvent(new Event("helpbar:expand"));
      return;
    }
  } catch {
    // Outside Tauri: fall through to the DOM toggle
  }
  window.dispatchEvent(new Event("helpbar:toggle"));
}

/** Registers the configured global shortcut and keeps it in sync with preferences. */
export function useGlobalShortcut() {
  const { prefs, setShortcutError } = usePreferences();
  const handlerRef = useRef<() => void>(() => void toggleHelpBar());

  useEffect(() => {
    let cancelled = false;
    void applyGlobalShortcut(prefs.globalShortcut, () => handlerRef.current()).then((error) => {
      if (!cancelled) setShortcutError(error);
    });
    return () => {
      cancelled = true;
    };
  }, [prefs.globalShortcut, setShortcutError]);
}
