import type { CSSProperties } from "react";

/**
 * Shared color palette for notes and calendar events. Values are stored as the
 * `key` (not the hex) so they stay stable across Tailwind rebuilds; helpers
 * resolve the key to inline styles (safe with Tailwind's JIT purging).
 */
export const COLOR_OPTIONS = [
  { key: "none", label: "Padrão", hex: "#a1a1aa" },
  { key: "blue", label: "Azul", hex: "#3b82f6" },
  { key: "purple", label: "Roxo", hex: "#a855f7" },
  { key: "green", label: "Verde", hex: "#22c55e" },
  { key: "red", label: "Vermelho", hex: "#ef4444" },
  { key: "amber", label: "Âmbar", hex: "#f59e0b" },
  { key: "cyan", label: "Ciano", hex: "#06b6d4" },
  { key: "pink", label: "Rosa", hex: "#ec4899" },
] as const;

export type ColorKey = (typeof COLOR_OPTIONS)[number]["key"];

const HEX_BY_KEY: Record<string, string> = Object.fromEntries(
  COLOR_OPTIONS.map((c) => [c.key, c.hex])
);

export function colorHex(key: string | undefined | null): string | null {
  if (!key || key === "none") return null;
  return HEX_BY_KEY[key] ?? null;
}

/** Inline style for a small colored dot. Returns null-safe empty object. */
export function dotStyle(key: string | undefined | null): CSSProperties {
  const hex = colorHex(key);
  return hex
    ? { backgroundColor: hex, boxShadow: `0 0 0 1px ${hex}55` }
    : { backgroundColor: "#52525b" };
}

/** Tinted background + border + text style for a chip/badge. */
export function chipStyle(key: string | undefined | null): CSSProperties {
  const hex = colorHex(key);
  return hex
    ? {
        backgroundColor: `${hex}22`,
        borderColor: `${hex}66`,
        color: "#f4f4f5",
      }
    : {};
}

export function isColorKey(value: string | undefined | null): value is ColorKey {
  return !!value && COLOR_OPTIONS.some((c) => c.key === value);
}
