import { describe, expect, it } from "vitest";
import { COLOR_OPTIONS, chipStyle, colorHex, dotStyle, isColorKey } from "./colors";

describe("colors", () => {
  it("maps known keys to hex and treats none/unknown as no color", () => {
    expect(colorHex("blue")).toBe("#3b82f6");
    expect(colorHex("purple")).toBe("#a855f7");
    expect(colorHex("none")).toBeNull();
    expect(colorHex(undefined)).toBeNull();
    expect(colorHex("bogus")).toBeNull();
  });

  it("validates palette keys", () => {
    expect(isColorKey("green")).toBe(true);
    expect(isColorKey("none")).toBe(true);
    expect(isColorKey("bogus")).toBe(false);
    expect(isColorKey(null)).toBe(false);
  });

  it("returns a neutral dot for the default color", () => {
    expect(dotStyle("none")).toEqual({ backgroundColor: "#52525b" });
    expect(dotStyle("red").backgroundColor).toBe("#ef4444");
  });

  it("returns no tint for the default color and a translucent tint otherwise", () => {
    expect(chipStyle("none")).toEqual({});
    expect(chipStyle("amber")).toMatchObject({
      backgroundColor: "#f59e0b22",
      borderColor: "#f59e0b66",
    });
  });

  it("keeps a stable set of palette keys", () => {
    expect(COLOR_OPTIONS.map((c) => c.key)).toEqual([
      "none",
      "blue",
      "purple",
      "green",
      "red",
      "amber",
      "cyan",
      "pink",
    ]);
  });
});
