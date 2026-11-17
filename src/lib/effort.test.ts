import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  formatEffortRange,
  parseHoursMinutes,
  findEffortSize,
  sumEffortParts,
  effectiveEffort,
  validateEffort,
} from "./effort";

describe("student effort", () => {
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [59, "59 min"],
    [60, "1 h"],
    [61, "1 h 1 min"],
    [90, "1 h 30 min"],
  ])("formats %s minutes", (minutes, expected) => {
    expect(formatMinutes(minutes as number)).toBe(expected);
  });
  it("formats ranges and equal ends", () => {
    expect(formatEffortRange({ minMinutes: 30, maxMinutes: 45 })).toBe(
      "30 to 45 min",
    );
    expect(formatEffortRange({ minMinutes: 60, maxMinutes: 90 })).toBe(
      "1 h to 1 h 30 min",
    );
    expect(formatEffortRange({ minMinutes: 60, maxMinutes: 60 })).toBe("1 h");
  });
  it.each([
    ["0", "59", 59],
    ["1", "0", 60],
    ["1", "1", 61],
    ["", "45", 45],
    ["0", "0", 0],
  ])("parses hours/minutes %s/%s", (h, m, expected) =>
    expect(parseHoursMinutes(h as string, m as string)).toBe(expected),
  );
  it.each([
    ["-1", "0"],
    ["1.5", "0"],
    ["x", "0"],
    ["0", "60"],
    ["", ""],
    ["1001", "0"],
  ])("rejects invalid hours/minutes %s/%s", (h, m) =>
    expect(() => parseHoursMinutes(h, m)).toThrow(),
  );
  it("matches minutes, not labels", () => {
    const size = { label: "Small", minMinutes: 30, maxMinutes: 45 };
    expect(findEffortSize([size], { minMinutes: 30, maxMinutes: 45 })).toBe(
      size,
    );
    expect(
      findEffortSize([size], { minMinutes: 30, maxMinutes: 46 }),
    ).toBeNull();
    expect(findEffortSize([size], null)).toBeNull();
  });
  it("sums parts and rejects an overflowing total", () => {
    expect(
      sumEffortParts([
        { minMinutes: 30, maxMinutes: 45 },
        { minMinutes: 60, maxMinutes: 90 },
      ]),
    ).toEqual({ minMinutes: 90, maxMinutes: 135 });
    expect(sumEffortParts([])).toBeNull();
    expect(() =>
      sumEffortParts([
        { minMinutes: 60000, maxMinutes: 60000 },
        { minMinutes: 1, maxMinutes: 1 },
      ]),
    ).toThrow();
  });
  it("uses the effective revision override, otherwise its base estimate", () => {
    const base = { effortMinMinutes: 30, effortMaxMinutes: 45 };
    expect(
      effectiveEffort(base, { effortMinMinutes: 60, effortMaxMinutes: 90 }),
    ).toEqual({ minMinutes: 60, maxMinutes: 90 });
    expect(
      effectiveEffort(base, { effortMinMinutes: null, effortMaxMinutes: null }),
    ).toEqual({ minMinutes: 30, maxMinutes: 45 });
    expect(effectiveEffort(null, null)).toBeNull();
  });
  it.each([
    [null, 1],
    [1, null],
    [0, 1],
    [2, 1],
    [1, 60001],
    [1.5, 2],
  ])("rejects invalid estimate %s to %s", (low, high) =>
    expect(() => validateEffort(low, high)).toThrow(),
  );
  it("accepts null, equal ends and the upper boundary", () => {
    expect(validateEffort(null, null)).toBeNull();
    expect(validateEffort(60000, 60000)).toEqual({
      minMinutes: 60000,
      maxMinutes: 60000,
    });
  });
});
