import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { CompactBar } from "./CompactBar";
import { ExpandedPanel } from "./ExpandedPanel";
import { useShellMode } from "../../hooks/useShellMode";
import { useReminderScheduler } from "../../hooks/useReminderScheduler";
import { useWindowPositioning } from "../../hooks/useWindowPositioning";
import { useGlobalShortcut } from "../../hooks/useGlobalShortcut";

export function Shell() {
  useReminderScheduler();
  useGlobalShortcut();
  const { mode, activeModule, setActiveModule, expand, collapse, togglePin, isOpen } =
    useShellMode();
  useWindowPositioning(mode, isOpen);

  // Global shortcut (DOM events) + tray settings action (Tauri event)
  useEffect(() => {
    const expandNow = () => {
      if (!isOpen) void expand();
    };
    const toggleNow = () => {
      if (isOpen) collapse();
      else void expand();
    };
    const openSettings = () => {
      setActiveModule("settings");
      if (!isOpen) void expand();
    };

    window.addEventListener("helpbar:expand", expandNow);
    window.addEventListener("helpbar:toggle", toggleNow);
    window.addEventListener("helpbar:open-settings", openSettings);
    return () => {
      window.removeEventListener("helpbar:expand", expandNow);
      window.removeEventListener("helpbar:toggle", toggleNow);
      window.removeEventListener("helpbar:open-settings", openSettings);
    };
  }, [isOpen, expand, collapse, setActiveModule]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    (async () => {
      try {
        unlisteners.push(
          await listen("helpbar:open-settings", () => {
            setActiveModule("settings");
            void expand();
          }),
        );
        unlisteners.push(
          await listen("helpbar:expand", () => {
            void expand();
          }),
        );
      } catch {
        // Outside Tauri
      }
    })();
    return () => {
      for (const unlisten of unlisteners) unlisten();
    };
  }, [expand, setActiveModule]);

  return (
    <div className="h-full w-full flex items-start justify-center">
      {isOpen ? (
        <ExpandedPanel
          mode={mode}
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          onCollapse={collapse}
          onTogglePin={togglePin}
        />
      ) : (
        <CompactBar onExpand={() => void expand()} />
      )}
    </div>
  );
}
