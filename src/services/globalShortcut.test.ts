import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn(async () => {}),
  unregister: vi.fn(async () => {}),
}));

import { shortcutDisplay } from "./globalShortcut";

describe("shortcutDisplay", () => {
  it("shows a placeholder when no shortcut is set", () => {
    expect(shortcutDisplay("")).toBe("Não definido");
  });

  it("translates modifiers and space", () => {
    expect(shortcutDisplay("Control+Alt+Space")).toBe("Ctrl+Alt+Espaço");
    expect(shortcutDisplay("Control+Shift+Space")).toBe("Ctrl+Shift+Espaço");
  });

  it("normalizes CommandOrControl and Super", () => {
    expect(shortcutDisplay("CommandOrControl+KeyH")).toBe("Ctrl+H");
    expect(shortcutDisplay("Super+ArrowUp")).toBe("Win+↑");
  });

  it("renders digits, arrows and letter codes", () => {
    expect(shortcutDisplay("Control+Digit1")).toBe("Ctrl+1");
    expect(shortcutDisplay("Alt+ArrowDown")).toBe("Alt+↓");
    expect(shortcutDisplay("Control+Alt+KeyK")).toBe("Ctrl+Alt+K");
  });

  it("trims spaces around each part", () => {
    expect(shortcutDisplay(" Control + Alt + Space ")).toBe("Ctrl+Alt+Espaço");
  });
});
