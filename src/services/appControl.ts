import { invoke } from "@tauri-apps/api/core";

/**
 * Fully terminates the app. Closing the HelpBar only hides it to the system
 * tray, so this is the explicit "quit" path used by the Settings screen.
 */
export async function quitApp(): Promise<void> {
  try {
    await invoke("quit_app");
  } catch (error) {
    console.error("Falha ao encerrar a HelpBar:", error);
  }
}
