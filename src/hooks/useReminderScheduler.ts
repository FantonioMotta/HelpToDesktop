import { useEffect } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useAppData } from "../store/AppDataContext";

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // Ignore audio errors
  }
}

export function useReminderScheduler() {
  const { reminders, markReminderNotified } = useAppData();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const perm = await requestPermission();
          granted = perm === "granted";
        }
        if (!granted || cancelled) return;
      } catch {
        // Outside Tauri or plugin unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const check = async () => {
      const now = Date.now();
      const due = reminders.filter((r) => !r.notified && r.dueAt <= now);
      if (due.length === 0) return;
      let granted = false;
      try {
        granted = await isPermissionGranted();
      } catch {
        return;
      }
      if (!granted) return;
      for (const r of due) {
        try {
          sendNotification({ title: "HelpBar - Lembrete", body: r.text });
        } catch {
          // ignore
        }
        playNotificationSound();
        markReminderNotified(r.id);
      }
    };

    void check();
    const id = window.setInterval(() => void check(), 30_000);
    return () => window.clearInterval(id);
  }, [reminders, markReminderNotified]);
}
