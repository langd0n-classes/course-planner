import { expect, it } from "vitest";
import { effectiveRevision, isUndatedMeeting, localDate } from "./term-revision-rules";
it("selects delivered facts before planned snapshots", () => {
  expect(effectiveRevision({ planned: "p", delivered: "d" })).toBe("d");
  expect(effectiveRevision({ planned: "p", delivered: null })).toBe("p");
  expect(effectiveRevision(undefined)).toBeNull();
});
it("only places undelivered undated planned meetings", () => {
  expect(isUndatedMeeting({ planned: {} })).toBe(true);
  expect(isUndatedMeeting({ planned: {}, delivered: "d" })).toBe(false);
  expect(isUndatedMeeting({ planned: { calendarSlotId: "s" } })).toBe(false);
  expect(isUndatedMeeting({ planned: { startsAt: "2026-01-01T12:00Z" } })).toBe(false);
  expect(isUndatedMeeting({ planned: null })).toBe(false);
});
it("uses local calendar dates and rejects invalid zones", () => {
  expect(localDate("2026-11-18T01:00Z", "America/New_York")).toBe("2026-11-17");
  expect(() => localDate("2026-11-18T01:00Z", "bad")).toThrow(RangeError);
  expect(localDate("2026-11-17", "America/New_York")).toBe("2026-11-17");
  expect(localDate("not an instant here")).toBe("not an ins");
});

it("explains missing milestone anchors in plain words at the request boundary", async () => {
  const { upsertTermActivityMilestoneSchema } = await import("./redesign-schemas");
  for (const anchorPolicy of ["follow_activity", "fixed_instant", "standalone"]) {
    const result = upsertTermActivityMilestoneSchema.safeParse({ role: "due", label: "Due", anchorPolicy });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/needs (a date|a linked Term Activity)/);
  }
});
