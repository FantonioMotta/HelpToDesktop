import { describe, expect, it } from "vitest";
import {
  formatDateInput,
  formatTimeInput,
  isValidDateBR,
  normalizeTime,
} from "./datetime";

describe("formatTimeInput", () => {
  it("keeps up to two digits without separator", () => {
    expect(formatTimeInput("9")).toBe("9");
    expect(formatTimeInput("09")).toBe("09");
  });

  it("inserts the colon after two digits", () => {
    expect(formatTimeInput("0930")).toBe("09:30");
    expect(formatTimeInput("9:30")).toBe("09:30");
  });

  it("ignores non-digits and extra digits", () => {
    expect(formatTimeInput("09h30m45")).toBe("09:30");
    expect(formatTimeInput("abc")).toBe("");
  });
});

describe("normalizeTime", () => {
  it("accepts hour-only values", () => {
    expect(normalizeTime("9")).toBe("09:00");
    expect(normalizeTime("23")).toBe("23:00");
  });

  it("accepts three and four digit values", () => {
    expect(normalizeTime("930")).toBe("09:30");
    expect(normalizeTime("09:30")).toBe("09:30");
    expect(normalizeTime("2359")).toBe("23:59");
  });

  it("rejects empty and out-of-range values", () => {
    expect(normalizeTime("")).toBeNull();
    expect(normalizeTime("24:00")).toBeNull();
    expect(normalizeTime("12:60")).toBeNull();
    expect(normalizeTime("9999")).toBeNull();
  });
});

describe("formatDateInput", () => {
  it("builds a DD/MM/AAAA mask progressively", () => {
    expect(formatDateInput("0")).toBe("0");
    expect(formatDateInput("0102")).toBe("01/02");
    expect(formatDateInput("01022026")).toBe("01/02/2026");
  });

  it("truncates extra digits and strips separators", () => {
    expect(formatDateInput("01/02/2026")).toBe("01/02/2026");
    expect(formatDateInput("010220269999")).toBe("01/02/2026");
  });
});

describe("isValidDateBR", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDateBR("01/02/2026")).toBe(true);
    expect(isValidDateBR("29/02/2024")).toBe(true);
  });

  it("rejects impossible or malformed dates", () => {
    expect(isValidDateBR("29/02/2023")).toBe(false);
    expect(isValidDateBR("31/04/2026")).toBe(false);
    expect(isValidDateBR("01/13/2026")).toBe(false);
    expect(isValidDateBR("1/2/2026")).toBe(false);
    expect(isValidDateBR("")).toBe(false);
  });
});
