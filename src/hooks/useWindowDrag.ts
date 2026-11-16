import { useCallback, useRef, useState } from "react";
import { getCurrentWindow, PhysicalPosition, currentMonitor } from "@tauri-apps/api/window";
import { usePreferences } from "../store/PreferencesContext";

type DragState = {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  startWinX: number;
  startWinY: number;
  scale: number;
  lockY: boolean;
  topY: number;
  captureEl: HTMLElement;
  win: ReturnType<typeof getCurrentWindow>;
  raf: number | null;
  pendingX: number;
  pendingY: number;
};

/**
 * Pointer-driven window drag for the compact bar.
 *
 * We deliberately avoid Tauri's `data-tauri-drag-region` (which hands the move
 * to the OS and allows both axes) because:
 *  - in blend mode the bar must stay glued to the top (X-only movement);
 *  - the OS drag is subject to Windows snapping near screen edges.
 *
 * `lockY` restricts the movement to the horizontal axis and forces Y to the
 * top edge of the monitor under the window.
 */
export function useWindowDrag(enabled: boolean, lockY: boolean) {
  const { setPrefs } = usePreferences();
  const [dragging, setDragging] = useState(false);
  const stateRef = useRef<DragState | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      // React nulls out currentTarget after the handler returns, so capture it now.
      const captureEl = e.currentTarget;
      const pointerId = e.pointerId;
      const startScreenX = e.screenX;
      const startScreenY = e.screenY;

      void (async () => {
        try {
          const win = getCurrentWindow();
          const [pos, scale, mon] = await Promise.all([
            win.outerPosition(),
            win.scaleFactor(),
            currentMonitor(),
          ]);
          stateRef.current = {
            pointerId,
            startScreenX,
            startScreenY,
            startWinX: pos.x,
            startWinY: pos.y,
            scale,
            lockY,
            topY: mon ? mon.position.y : 0,
            captureEl,
            win,
            raf: null,
            pendingX: pos.x,
            pendingY: pos.y,
          };
          try {
            captureEl.setPointerCapture(pointerId);
          } catch {
            // ignore
          }
          setDragging(true);
        } catch {
          // Outside Tauri
        }
      })();
    },
    [enabled, lockY],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const st = stateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dx = Math.round((e.screenX - st.startScreenX) * st.scale);
    const dy = Math.round((e.screenY - st.startScreenY) * st.scale);
    st.pendingX = Math.max(0, st.startWinX + dx);
    st.pendingY = st.lockY ? st.topY : Math.max(0, st.startWinY + dy);
    if (st.raf !== null) return;
    st.raf = window.requestAnimationFrame(() => {
      const cur = stateRef.current;
      if (!cur) return;
      cur.raf = null;
      void cur.win
        .setPosition(new PhysicalPosition(cur.pendingX, cur.pendingY))
        .catch(() => {});
    });
  }, []);

  const finish = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const st = stateRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      stateRef.current = null;
      setDragging(false);
      if (st.raf !== null) window.cancelAnimationFrame(st.raf);
      try {
        st.captureEl.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      void (async () => {
        try {
          const pos = await st.win.outerPosition();
          setPrefs({
            customPosition: { x: pos.x, y: st.lockY ? st.topY : pos.y },
          });
        } catch {
          // ignore
        }
      })();
    },
    [setPrefs],
  );

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  };

  return { dragging, handlers };
}
