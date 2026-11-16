import Database from "@tauri-apps/plugin-sql";

export const DATABASE_FILE = "sqlite:helpbar.db";

/** True when running inside the Tauri webview (DB plugin available). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let dbPromise: Promise<Database> | null = null;

/**
 * Opens the local SQLite database. Returns `null` when running in a plain
 * browser (e.g. `npm run dev`), so the store can fall back to session memory.
 */
export async function openDatabase(): Promise<Database | null> {
  if (!isTauriRuntime()) return null;
  if (!dbPromise) {
    dbPromise = Database.load(DATABASE_FILE);
  }
  return dbPromise;
}

/** Absolute-ish location of the database, for display in Settings. */
export function databaseLocationLabel(): string {
  return "%APPDATA%\\com.helpbar.desktop\\helpbar.db";
}
