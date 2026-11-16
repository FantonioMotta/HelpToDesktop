import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

let activeShortcut: string | null = null;
let desiredShortcut = "";
let activeHandler: (() => void) | null = null;
let suspendedShortcut: string | null = null;

let activeHoldShortcut: string | null = null;
let desiredHoldShortcut = "";
let holdHandlers: { onPress: () => void; onRelease?: () => void } | null = null;
let suspendedHoldShortcut: string | null = null;

async function registerDesired(): Promise<string | null> {
  if (!desiredShortcut) return null;
  if (activeShortcut === desiredShortcut) return null;
  try {
    await register(desiredShortcut, (event) => {
      if (event.state === "Pressed") activeHandler?.();
    });
    activeShortcut = desiredShortcut;
    return null;
  } catch (err) {
    activeShortcut = null;
    return err instanceof Error ? err.message : String(err);
  }
}

async function registerHoldDesired(): Promise<string | null> {
  if (!desiredHoldShortcut) return null;
  if (activeHoldShortcut === desiredHoldShortcut) return null;
  if (desiredHoldShortcut === desiredShortcut) {
    return "O atalho da ATLAS não pode ser igual ao atalho de abrir a HelpBar.";
  }
  try {
    await register(desiredHoldShortcut, (event) => {
      if (event.state === "Pressed") holdHandlers?.onPress();
      else if (event.state === "Released") holdHandlers?.onRelease?.();
    });
    activeHoldShortcut = desiredHoldShortcut;
    return null;
  } catch (err) {
    activeHoldShortcut = null;
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Registers the desired global shortcut, unregistering the previous one.
 * Returns an error message when registration fails (e.g. shortcut taken).
 */
export async function applyGlobalShortcut(
  shortcut: string,
  handler: () => void,
): Promise<string | null> {
  const desired = shortcut.trim();
  desiredShortcut = desired;
  activeHandler = handler;

  if (activeShortcut && activeShortcut !== desired) {
    try {
      await unregister(activeShortcut);
    } catch {
      // ignore
    }
    activeShortcut = null;
  }

  return registerDesired();
}

/**
 * Temporarily releases the shortcut so the Settings recorder can capture the
 * same combination the user already has registered.
 */
export async function suspendGlobalShortcut(): Promise<void> {
  if (!activeShortcut) return;
  suspendedShortcut = activeShortcut;
  try {
    await unregister(activeShortcut);
  } catch {
    // ignore
  }
  activeShortcut = null;
}

/** Re-registers a previously suspended shortcut (no-op if preferences changed meanwhile). */
export async function resumeGlobalShortcut(): Promise<string | null> {
  const suspended = suspendedShortcut;
  suspendedShortcut = null;
  if (!suspended) return null;
  if (suspended !== desiredShortcut) return null;
  if (activeShortcut === suspended) return null;
  return registerDesired();
}

/**
 * Registers a press-and-hold global shortcut (used for ATLAS push-to-talk).
 * Returns an error message when registration fails.
 */
export async function applyHoldShortcut(
  shortcut: string,
  handlers: { onPress: () => void; onRelease?: () => void },
): Promise<string | null> {
  const desired = shortcut.trim();
  desiredHoldShortcut = desired;
  holdHandlers = handlers;

  if (activeHoldShortcut && activeHoldShortcut !== desired) {
    try {
      await unregister(activeHoldShortcut);
    } catch {
      // ignore
    }
    activeHoldShortcut = null;
  }

  if (!desired) return null;
  return registerHoldDesired();
}

/** Temporarily releases the ATLAS shortcut so the recorder can capture it. */
export async function suspendHoldShortcut(): Promise<void> {
  if (!activeHoldShortcut) return;
  suspendedHoldShortcut = activeHoldShortcut;
  try {
    await unregister(activeHoldShortcut);
  } catch {
    // ignore
  }
  activeHoldShortcut = null;
}

export async function resumeHoldShortcut(): Promise<string | null> {
  const suspended = suspendedHoldShortcut;
  suspendedHoldShortcut = null;
  if (!suspended) return null;
  if (suspended !== desiredHoldShortcut) return null;
  if (activeHoldShortcut === suspended) return null;
  return registerHoldDesired();
}

/** Human friendly label for a Tauri accelerator (e.g. "Control+Alt+Space" -> "Ctrl+Alt+Espaço"). */
export function shortcutDisplay(shortcut: string): string {
  if (!shortcut) return "Não definido";
  return shortcut
    .split("+")
    .map((raw) => {
      const part = raw.trim();
      const up = part.toUpperCase();
      if (up === "CONTROL" || up === "CTRL" || up === "COMMANDORCONTROL") return "Ctrl";
      if (up === "SUPER" || up === "COMMAND" || up === "CMD") return "Win";
      if (up === "ALT" || up === "OPTION") return "Alt";
      if (up === "SHIFT") return "Shift";
      if (/^KEY[A-Z]$/.test(up)) return up.slice(3);
      if (/^DIGIT[0-9]$/.test(up)) return up.slice(5);
      if (up === "SPACE") return "Espaço";
      if (up === "ARROWUP") return "↑";
      if (up === "ARROWDOWN") return "↓";
      if (up === "ARROWLEFT") return "←";
      if (up === "ARROWRIGHT") return "→";
      return part;
    })
    .join("+");
}
