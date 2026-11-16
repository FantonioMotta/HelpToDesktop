import { describe, expect, it } from "vitest";
import {
  addDays,
  brToISO,
  formatDateBRFromISO,
  parseISODate,
  sameDay,
  startOfWeek,
  toISODate,
} from "./dateUtils";

describe("toISODate", () => {
  it("formats local dates with zero padding", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("parseISODate", () => {
  it("parses ISO strings as local dates", () => {
    const d = parseISODate("2026-03-09");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(9);
  });

  it("round-trips with toISODate", () => {
    expect(toISODate(parseISODate("2026-07-01"))).toBe("2026-07-01");
  });
});

describe("formatDateBRFromISO", () => {
  it("renders a Brazilian formatted date", () => {
    expect(formatDateBRFromISO("2026-03-09")).toBe("09/03/2026");
  });
});

describe("brToISO", () => {
  it("converts valid DD/MM/AAAA dates", () => {
    expect(brToISO("09/03/2026")).toBe("2026-03-09");
    expect(brToISO("29/02/2024")).toBe("2024-02-29");
  });

  it("rejects invalid dates", () => {
    expect(brToISO("31/02/2026")).toBeNull();
    expect(brToISO("2026-03-09")).toBeNull();
    expect(brToISO("09/03/26")).toBeNull();
  });
});

describe("startOfWeek", () => {
  it("returns the previous Sunday at midnight", () => {
    // 2026-03-11 is a Wednesday.
    const wednesday = new Date(2026, 2, 11, 15, 42, 10);
    const start = startOfWeek(wednesday);
    expect(toISODate(start)).toBe("2026-03-08");
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it("keeps a Sunday unchanged", () => {
    const sunday = new Date(2026, 2, 8, 10, 0, 0);
    expect(toISODate(startOfWeek(sunday))).toBe("2026-03-08");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(toISODate(addDays(new Date(2026, 0, 31), 1))).toBe("2026-02-01");
    expect(toISODate(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
    expect(toISODate(addDays(new Date(2026, 2, 1), -1))).toBe("2026-02-28");
  });

  it("does not mutate the original date", () => {
    const original = new Date(2026, 4, 10);
    addDays(original, 5);
    expect(toISODate(original)).toBe("2026-05-10");
  });
});

describe("sameDay", () => {
  it("compares calendar days ignoring time", () => {
    expect(sameDay(new Date(2026, 4, 10, 1), new Date(2026, 4, 10, 23))).toBe(true);
    expect(sameDay(new Date(2026, 4, 10), new Date(2026, 4, 11))).toBe(false);
  });
});
