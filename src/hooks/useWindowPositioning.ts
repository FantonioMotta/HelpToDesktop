import { useCallback, useEffect, useRef } from "react";
import { getCurrentWindow, PhysicalPosition, currentMonitor } from "@tauri-apps/api/window";
import type { ShellMode } from "../types/shell";
import { usePreferences } from "../store/PreferencesContext";

const TOP_MARGIN = 8;

/**
 * Owns compact-mode window placement and the "glued to top" behavior of blend mode.
 *
 * - blend mode: Y is always clamped to the current monitor's top edge. This is
 *   enforced on every window move, so it holds regardless of how the window was
 *   moved (custom X-only drag, OS drag, snapping, etc.).
 * - allowMove: the resulting X position is persisted and restored, so the bar
 *   stays where the user left it horizontally.
 */
export function useWindowPositioning(mode: ShellMode, isOpen: boolean) {
  const { prefs, setPrefs } = usePreferences();
  const applyingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const enforceRafRef = useRef<number | null>(null);
  const wasOpenRef = useRef(isOpen);
  const blendRef = useRef(prefs.visualMode);
  const allowMoveRef = useRef(prefs.allowMove);

  useEffect(() => {
    blendRef.current = prefs.visualMode;
  }, [prefs.visualMode]);

  useEffect(() => {
    allowMoveRef.current = prefs.allowMove;
  }, [prefs.allowMove]);

  const persistPosition = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      if (blendRef.current) {
        const mon = await currentMonitor();
        setPrefs({ customPosition: { x: pos.x, y: mon ? mon.position.y : pos.y } });
      } else if (allowMoveRef.current) {
        setPrefs({ customPosition: { x: pos.x, y: pos.y } });
      }
    } catch {
      // ignore
    }
  }, [setPrefs]);

  // Glue to the top in blend mode: correct Y after any window move.
  useEffect(() => {
    if (prefs.visualMode !== "blend") return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const clampToTop = () => {
      if (disposed || applyingRef.current) return;
      if (enforceRafRef.current !== null) return;
      enforceRafRef.current = window.requestAnimationFrame(() => {
        enforceRafRef.current = null;
        void (async () => {
          try {
            const win = getCurrentWindow();
            const mon = await currentMonitor();
            if (!mon) return;
            const pos = await win.outerPosition();
            if (pos.y === mon.position.y) return;
            applyingRef.current = true;
            await win.setPosition(new PhysicalPosition(pos.x, mon.position.y));
            window.setTimeout(() => {
              applyingRef.current = false;
            }, 150);
          } catch {
            // ignore
          }
        })();
      });
    };

    (async () => {
      try {
        const win = getCurrentWindow();
        unlisten = await win.onMoved(() => {
          clampToTop();
          if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = window.setTimeout(() => void persistPosition(), 450);
        });
      } catch {
        // outside Tauri
      }
    })();

    // Also clamp immediately when blend is enabled (or when the app starts).
    if (!isOpen) clampToTop();

    return () => {
      disposed = true;
      if (unlisten) unlisten();
      if (enforceRafRef.current !== null) {
        window.cancelAnimationFrame(enforceRafRef.current);
        enforceRafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.visualMode]);

  // Persist position after user movement (non-blend; blend already persists above).
  useEffect(() => {
    if (!prefs.allowMove || prefs.visualMode === "blend") return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const win = getCurrentWindow();
        unlisten = await win.onMoved(({ payload }) => {
          if (applyingRef.current) return;
          if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = window.setTimeout(() => {
            setPrefs({ customPosition: { x: payload.x, y: payload.y } });
          }, 450);
        });
      } catch {
        // outside tauri
      }
    })();
    return () => {
      if (unlisten) unlisten();
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [prefs.allowMove, prefs.visualMode, setPrefs]);

  // Apply position ONLY on transitions into compact mode (not on every pref change).
  useEffect(() => {
    const toCompact = isOpen === false && wasOpenRef.current === true;
    const initialCompact = !isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (isOpen) return;
    if (!toCompact && !initialCompact) return;

    let cancelled = false;
    (async () => {
      try {
        const win = getCurrentWindow();
        await new Promise((r) => setTimeout(r, 80));
        if (cancelled) return;

        applyingRef.current = true;

        if (prefs.allowMove && prefs.customPosition) {
          let y = prefs.customPosition.y;
          if (prefs.visualMode === "blend") {
            // Blend mode is glued to the top edge: ignore any saved Y offset.
            const mon = await currentMonitor();
            if (mon) y = mon.position.y;
          }
          await win.setPosition(new PhysicalPosition(prefs.customPosition.x, y));
        } else {
          const mon = await currentMonitor();
          if (!mon) return;
          const size = await win.outerSize();
          const screen = mon.size;
          const pos = mon.position;
          const margin = Math.round(TOP_MARGIN * mon.scaleFactor);
          let x = pos.x + Math.round((screen.width - size.width) / 2);
          if (prefs.anchor === "top-left") x = pos.x + margin;
          if (prefs.anchor === "top-right") x = pos.x + screen.width - size.width - margin;
          const y = pos.y; // compact flush top
          await win.setPosition(new PhysicalPosition(Math.max(pos.x, x), y));
        }
      } catch {
        // ignore
      } finally {
        window.setTimeout(() => {
          applyingRef.current = false;
        }, 250);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally only react to mode transitions; prefs are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
