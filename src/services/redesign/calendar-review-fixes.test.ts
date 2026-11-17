/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma fixtures */
import { expect, it, vi } from "vitest";
import { previewTermCalendar, applyTermCalendar } from "./academic-calendar-service";
import { ConcurrencyConflictError } from "./errors";
function fixture() {
  const pattern = (type: string, days: string[]) => ({ activityTypeVersionId: type, daysOfWeek: days, startTimeLocal: "09:00", endTimeLocal: "10:00", timeZone: "America/New_York", startsOn: "2027-03-01", endsOn: "2027-03-05" });
  const lecture = pattern("lecture", ["monday", "wednesday"]), lab = pattern("lab", ["friday"]);
  const tx: any = {
    term: { findUnique: async () => ({ id: "t", startDate: new Date("2027-03-01"), endDate: new Date("2027-03-05"), academicCalendarId: "c", academicCalendarVersionId: "v", course: { instructorId: "i" } }) },
    academicCalendarVersion: { findUnique: async () => ({ id: "v" }) },
    academicCalendarEvent: { findMany: async () => [] }, academicCalendarPeriod: { findMany: async () => [] },
    termMeetingPattern: { findMany: async () => [lecture, lab].map(p => ({ ...p, startsOn: new Date(p.startsOn), endsOn: new Date(p.endsOn) })), deleteMany: vi.fn(), createMany: vi.fn() },
    termCalendarException: { findMany: async () => [] },
    termMeetingActivityRevision: { findMany: vi.fn(async () => []) },
    session: { count: vi.fn(async () => 0) },
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
  if (kind === "meeting") f.tx.termMeetingActivityRevision.findMany.mockResolvedValue([{ termActivityRevision: { termActivityId: "a" } }, { termActivityRevision: { termActivityId: "a" } }]);
  if (kind === "exception") f.tx.termCalendarException.findMany = async () => [{ id: "e", action: "modify", calendarSlotId: "01" }];
  if (kind === "session") f.tx.session.count.mockResolvedValue(1);
  const p = await previewTermCalendar(f.db, f.input);
  expect(p.affectedMeetingCount).toBe(kind === "meeting" ? 1 : 0);
  expect(p.conflicts.some(c => c.code === "referenced_slots_removed")).toBe(true);
  await expect(applyTermCalendar(f.db, { ...f.input, previewToken: p.previewToken, expectedCurrentCalendarSlotCount: 3 })).rejects.toBeInstanceOf(ConcurrencyConflictError);
  expect(f.tx.termMeetingPattern.deleteMany).not.toHaveBeenCalled();
  expect(f.tx.calendarSlot.deleteMany).not.toHaveBeenCalled();
});
