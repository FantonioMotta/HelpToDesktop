import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn(async () => {}),
  unregister: vi.fn(async () => {}),
}));

import { register } from "@tauri-apps/plugin-global-shortcut";
import {
  applyGlobalShortcut,
  applyHoldShortcut,
  shortcutDisplay,
} from "./globalShortcut";

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

describe("applyHoldShortcut", () => {
  it("refuses the same combination as the main HelpBar shortcut", async () => {
    expect(await applyGlobalShortcut("Control+Alt+KeyG", () => {})).toBeNull();
    const error = await applyHoldShortcut("Control+Alt+KeyG", { onPress: () => {} });
    expect(error).toMatch(/não pode ser igual/i);
  });

  it("forwards Pressed and Released states to the handlers", async () => {
    const onPress = vi.fn();
    const onRelease = vi.fn();
    expect(await applyHoldShortcut("Control+Alt+KeyQ", { onPress, onRelease })).toBeNull();

    const call = vi
      .mocked(register)
      .mock.calls.find(([shortcut]) => shortcut === "Control+Alt+KeyQ");
    expect(call).toBeDefined();
    const handler = call?.[1];
    handler?.({ state: "Pressed" } as any);
    handler?.({ state: "Released" } as any);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });
});
