/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma fixtures */
import { expect, it, vi } from "vitest";
import { previewTermCalendar, applyTermCalendar } from "./academic-calendar-service";
import { CalendarSlotRemovalError } from "./errors";
function fixture() {
  const pattern = (type: string, days: string[]) => ({ activityTypeVersionId: type, daysOfWeek: days, startTimeLocal: "09:00", endTimeLocal: "10:00", timeZone: "America/New_York", startsOn: "2027-03-01", endsOn: "2027-03-05" });
  const lecture = pattern("lecture", ["monday", "wednesday"]), lab = pattern("lab", ["friday"]);
  const tx: any = {
    term: { findUnique: async () => ({ id: "t", startDate: new Date("2027-03-01"), endDate: new Date("2027-03-05"), academicCalendarId: "c", academicCalendarVersionId: "v", course: { instructorId: "i" } }) },
    academicCalendarVersion: { findUnique: async () => ({ id: "v" }) },
    academicCalendarEvent: { findMany: async () => [] }, academicCalendarPeriod: { findMany: async () => [] },
    termMeetingPattern: { findMany: async () => [lecture, lab].map(p => ({ ...p, startsOn: new Date(p.startsOn), endsOn: new Date(p.endsOn) })), deleteMany: vi.fn(), createMany: vi.fn() },
    termCalendarException: { findMany: async () => [] },
    termActivity: { findMany: vi.fn(async () => []) },
    session: { findMany: vi.fn(async () => []) },
    calendarSlot: { findMany: async () => ["01", "03", "05"].map(d => ({ id: d, date: new Date(`2027-03-${d}`) })), deleteMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  };
  return { tx, db: { $transaction: async (fn: any) => fn(tx) }, input: { instructorId: "i", termId: "t", meetingPatterns: [lab] }, lecture };
}
it("merges stored Lecture patterns when reapplying only Lab", async () => {
  const f = fixture();
  const p = await previewTermCalendar(f.db, f.input);
  expect(p.calendarSlotCandidates.map(s => s.date)).toEqual(["2027-03-01", "2027-03-03", "2027-03-05"]);
  await applyTermCalendar(f.db, { ...f.input, previewToken: p.previewToken, expectedCurrentCalendarSlotCount: 3 });
  expect(f.tx.calendarSlot.update).toHaveBeenCalledTimes(3);
});
it.each(["meeting", "exception", "session"])("blocks deletion referenced by a %s before writes", async kind => {
  const f = fixture();
  f.input.meetingPatterns = [{ ...f.lecture, daysOfWeek: ["wednesday"] }];
  if (kind === "meeting") f.tx.termActivity.findMany.mockResolvedValue([{ id: "a", plannedRevision: { meetingDetail: { calendarSlotId: "01", status: "scheduled" } } }]);
  if (kind === "exception") f.tx.termCalendarException.findMany = async () => [{ id: "e", action: "modify", calendarSlotId: "01" }];
  if (kind === "session") f.tx.session.findMany.mockResolvedValue([{ calendarSlotId: "01" }]);
  const p = await previewTermCalendar(f.db, f.input);
  expect(p.affectedMeetingCount).toBe(kind === "meeting" ? 1 : 0);
  expect(p.conflicts).toContainEqual(expect.objectContaining({ code: "referenced_slots_removed", date: "2027-03-01", message: expect.stringContaining("2027-03-01") }));
  await expect(applyTermCalendar(f.db, { ...f.input, previewToken: p.previewToken, expectedCurrentCalendarSlotCount: 3 })).rejects.toBeInstanceOf(CalendarSlotRemovalError);
  expect(f.tx.termMeetingPattern.deleteMany).not.toHaveBeenCalled();
  expect(f.tx.calendarSlot.deleteMany).not.toHaveBeenCalled();
});

it.each(["superseded", "planned canceled", "delivered canceled", "archived"])("allows removing a date referenced only by %s revisions", async kind => {
  const f = fixture();
  f.input.meetingPatterns = [{ ...f.lecture, daysOfWeek: ["wednesday"] }];
  const detail = (calendarSlotId: string, status = "scheduled") => ({ meetingDetail: { calendarSlotId, status } });
  f.tx.termActivity.findMany.mockResolvedValue([{ id: "a", archivedAt: kind === "archived" ? new Date() : null,
    plannedRevision: detail("01", kind === "planned canceled" ? "canceled" : "scheduled"),
    deliveredRevision: kind === "superseded" ? detail("03") : kind === "delivered canceled" ? detail("01", "canceled") : null,
  }]);
  const p = await previewTermCalendar(f.db, f.input);
  expect(p.affectedMeetingCount).toBe(0);
  expect(p.conflicts).toEqual([]);
  await applyTermCalendar(f.db, { ...f.input, previewToken: p.previewToken, expectedCurrentCalendarSlotCount: 3 });
  expect(f.tx.calendarSlot.deleteMany).toHaveBeenCalled();
});

it("lists every blocked date with its own reference counts in preview and refusal", async () => {
  const f = fixture();
  f.input.meetingPatterns = [{ ...f.lecture, startsOn: "2027-03-04", daysOfWeek: ["wednesday"] }];
  f.tx.termActivity.findMany.mockResolvedValue([
    { id: "a", plannedRevision: { meetingDetail: { calendarSlotId: "01", status: "scheduled" } } },
    { id: "b", plannedRevision: { meetingDetail: { calendarSlotId: "03", status: "scheduled" } } },
    { id: "c", plannedRevision: { meetingDetail: { calendarSlotId: "03", status: "scheduled" } } },
  ]);
  f.tx.session.findMany.mockResolvedValue([{ calendarSlotId: "01" }]);
  const preview = await previewTermCalendar(f.db, f.input);
  expect(preview.affectedMeetingCount).toBe(3);
  expect(preview.conflicts.map(c => [c.date, c.message])).toEqual([
    ["2027-03-01", "Cannot remove calendar date 2027-03-01: 1 affected meetings, 0 calendar exceptions, 1 Sessions."],
    ["2027-03-03", "Cannot remove calendar date 2027-03-03: 2 affected meetings, 0 calendar exceptions, 0 Sessions."],
  ]);
  await expect(applyTermCalendar(f.db, { ...f.input, previewToken: preview.previewToken, expectedCurrentCalendarSlotCount: 3 }))
    .rejects.toMatchObject({ name: "CalendarSlotRemovalError", message: expect.stringMatching(/2027-03-01: 1 affected meetings.*2027-03-03: 2 affected meetings/) });
});
