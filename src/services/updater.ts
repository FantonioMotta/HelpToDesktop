import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateInfo = {
  version: string;
  currentVersion: string;
  date?: string;
  notes?: string;
};

export type UpdateProgress = {
  downloaded: number;
  total: number | null;
  percent: number | null;
};

type UpdateHandle = {
  info: UpdateInfo;
  install: (onProgress?: (progress: UpdateProgress) => void) => Promise<void>;
  close: () => Promise<void>;
};

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Checks GitHub Releases for a newer version. Returns null when up to date. */
export async function checkForUpdate(): Promise<UpdateHandle | null> {
  if (!isTauri()) return null;

  const update: Update | null = await check();
  if (!update) return null;

  const info: UpdateInfo = {
    version: update.version,
    currentVersion: update.currentVersion,
    date: update.date,
    notes: update.body,
  };

  return {
    info,
    install: async (onProgress) => {
      let downloaded = 0;
      let total: number | null = null;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? null;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const percent = total && total > 0 ? Math.min(100, (downloaded / total) * 100) : null;
          onProgress?.({ downloaded, total, percent });
        }
      });
    },
    close: () => update.close(),
  };
}

/** Restarts the app so the freshly installed version takes over. */
export async function restartApp(): Promise<void> {
  if (isTauri()) await relaunch();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
