/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it, vi } from "vitest";
import { applyTermCreation, previewTermCreation, updateTerm } from "./term-service";
import { applyTermClone, previewTermClone } from "./clone-service";
import { previewCalendarMaterialization } from "./calendar-materialization-service";
import { applyTermCalendar, previewTermCalendar } from "./academic-calendar-service";
import { removeTermLearningModule } from "./offering-service";
import { ConcurrencyConflictError, DomainInvariantError } from "./errors";

const input = { instructorId: "i", courseId: "c", institutionId: "inst", academicCalendarId: "cal", sourceTermId: "source", code: "F26", name: "Fall", startDate: new Date("2026-01-01"), endDate: new Date("2026-05-01"), meetingPattern: { days: ["Monday"] } };
function fixture() {
  const term = { id: "source", ...input, status: "planned", course: { instructorId: "i" }, learningModules: [], sessions: [], assessments: [], calendarSlots: [] };
  const tx: any = {
    course: { findUnique: vi.fn(async () => ({ id: "c", instructorId: "i" })) },
    courseInstitution: { findMany: vi.fn(async () => [{ institutionId: "inst" }]), findUnique: vi.fn(async () => ({})) },
    instructorInstitution: { findUnique: vi.fn(async () => ({ status: "active" })) },
    academicCalendar: { findUnique: vi.fn(async () => ({})) },
    academicCalendarEvent: { findMany: vi.fn(async () => []) },
    instructorCalendarOverride: { findMany: vi.fn(async () => []) },
    term: { findUnique: vi.fn(async ({ where }: any) => where.id ? term : null), create: vi.fn(async ({ data }: any) => ({ id: "new", ...data })), update: vi.fn(async ({ data }: any) => ({ ...term, ...data })) },
    calendarSlot: { create: vi.fn(async () => ({ id: "slot" })) },
  };
  return { tx, term, db: { $transaction: async <T>(fn: (tx: any) => Promise<T>) => fn(tx) } };
}
const operations = [
  ["create", (db: any, value: any) => applyTermCreation(db, value)],
  ["create preview", (db: any, value: any) => previewTermCreation(db, value)],
  ["update", (db: any, value: any) => updateTerm(db, "source", value)],
  ["clone", (db: any, value: any) => applyTermClone(db, value)],
  ["clone preview", (db: any, value: any) => previewTermClone(db, value)],
] as const;
describe.each(operations)("%s hardening", (_name, operation) => {
  it.each([
    ["invalid start", { startDate: new Date("2026-13-45") }, /real calendar date/],
    ["invalid end", { endDate: new Date("2026-13-45") }, /real calendar date/],
    ["normalized impossible day", { startDate: "2026-02-30" }, /real calendar date/],
    ["reversed dates", { endDate: new Date("2025-01-01") }, /after/],
    ["over 400 days", { endDate: new Date("2027-02-06") }, /400 days/],
  ])("rejects %s", async (_label, change, message) => {
    const { db, tx } = fixture();
    await expect(operation(db, { ...input, ...change })).rejects.toThrow(message);
    expect(tx.term.create).not.toHaveBeenCalled();
    expect(tx.term.update).not.toHaveBeenCalled();
  });
  it("rejects a code already used by another Term in the Course", async () => {
    const { db, tx, term } = fixture();
    tx.term.findUnique.mockImplementation(async ({ where }: any) => where.id ? term : { id: "other" });
    await expect(operation(db, input)).rejects.toThrow(ConcurrencyConflictError);
    await expect(operation(db, input)).rejects.toThrow(/F26/);
    expect(tx.term.create).not.toHaveBeenCalled();
    expect(tx.term.update).not.toHaveBeenCalled();
  });
});
it.each(operations.filter(([name]) => !name.includes("preview")))("%s maps a racing Prisma P2002 to a code conflict", async (_name, operation) => {
  const { db, tx } = fixture();
  tx.term.create.mockRejectedValue({ code: "P2002", meta: { target: ["courseId", "code"] } });
  tx.term.update.mockRejectedValue({ code: "P2002", meta: { target: ["courseId", "code"] } });
  await expect(operation(db, input)).rejects.toThrow(ConcurrencyConflictError);
  await expect(operation(db, input)).rejects.toThrow(/F26/);
});
it("allows update with its own code and validates a partial date update against the stored date", async () => {
  const { db, tx, term } = fixture();
  tx.term.findUnique.mockResolvedValue(term);
  await expect(updateTerm(db, "source", { instructorId: "i", code: "F26" })).resolves.toMatchObject({ code: "F26" });
  await expect(updateTerm(db, "source", { instructorId: "i", startDate: new Date("2026-06-01") })).rejects.toThrow(/after/);
});
it("allows exactly 400 elapsed days", async () => {
  const { db } = fixture();
  await expect(applyTermCreation(db, { ...input, endDate: new Date("2027-02-05") })).resolves.toMatchObject({ kind: "applied" });
});
it("bounds legacy calendar materialization and reports the limit", async () => {
  const { tx } = fixture();
  const preview = await previewCalendarMaterialization(tx, { ...input, endDate: new Date("2027-05-16") });
  expect(preview.warnings.join(" ")).toMatch(/400/);
  expect(preview.candidates.length).toBeLessThanOrEqual(400);
});
function calendarFixture() {
  const value = fixture();
  Object.assign(value.term, { academicCalendarVersionId: "v", endDate: new Date("2027-05-16") });
  Object.assign(value.tx, {
    academicCalendarVersion: { findUnique: vi.fn(async () => ({ id: "v" })) },
    academicCalendarPeriod: { findMany: vi.fn(async () => []) },
    termCalendarException: { findMany: vi.fn(async () => []) },
    termMeetingPattern: { deleteMany: vi.fn() },
  });
  value.tx.academicCalendarEvent.findMany.mockResolvedValue([{ id: "e", eventType: "holiday", startsOn: value.term.startDate, endsOn: value.term.endDate, label: "Break" }]);
  Object.assign(value.tx.calendarSlot, { findMany: vi.fn(async () => []), deleteMany: vi.fn(), createMany: vi.fn() });
  return value;
}
it("previews and applies the first 400 days of a stored 500-day Term", async () => {
  const { db, tx } = calendarFixture();
  const preview = await previewTermCalendar(db, { instructorId: "i", termId: "source", meetingPatterns: [] });
  expect(preview.warnings.join(" ")).toMatch(/400/);
  expect(preview.calendarSlotCandidates).toHaveLength(400);
  expect(preview.calendarSlotCandidates.at(-1)?.date).toBe("2027-02-04");
  await expect(applyTermCalendar(db, { instructorId: "i", termId: "source", meetingPatterns: [], previewToken: preview.previewToken, expectedCurrentCalendarSlotCount: 0 })).resolves.toBeDefined();
  expect(tx.calendarSlot.createMany.mock.calls[0][0].data).toHaveLength(400);
});
it("allows a name-only edit on a stored 500-day Term", async () => {
  const { db, term } = fixture();
  term.endDate = new Date("2027-05-16");
  await expect(updateTerm(db, "source", { instructorId: "i", name: "Renamed" })).resolves.toMatchObject({ name: "Renamed" });
});
it.each(operations)("%s allows a one-day Term", async (_name, operation) => {
  const { db } = fixture();
  await expect(operation(db, { ...input, endDate: input.startDate })).resolves.toBeDefined();
});
it.each(operations.filter(([name]) => !name.includes("preview")))("%s preserves unrelated unique errors", async (_name, operation) => {
  const { db, tx } = fixture();
  for (const target of [["id"], ["courseId", "name"], undefined]) {
    const error = { code: "P2002", meta: { target } };
    tx.term.create.mockRejectedValue(error);
    tx.term.update.mockRejectedValue(error);
    await expect(operation(db, input)).rejects.toBe(error);
  }
});
it("refuses calendar apply on a closed Term before any calendar writes", async () => {
  const { db, term } = fixture();
  term.status = "closed";
  await expect(applyTermCalendar(db, { instructorId: "i", termId: "source", meetingPatterns: [], previewToken: "token", expectedCurrentCalendarSlotCount: 0 })).rejects.toThrow("Closed Terms are read-only");
});
function offeringFixture(count: number) {
  const offering = { id: "offering", term: { status: "active", course: { instructorId: "i" } } };
  const tx: any = { termLearningModule: { findUnique: vi.fn(async () => offering), delete: vi.fn(async () => offering) }, session: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) }, termActivity: { count: vi.fn(async () => count) } };
  return { tx, db: { $transaction: async <T>(fn: (tx: any) => Promise<T>) => fn(tx) } };
}
it("reports Term Activities as counted removal blockers and refuses removal", async () => {
  const { db, tx } = offeringFixture(2);
  await expect(removeTermLearningModule(db, "i", "offering")).rejects.toThrow(/2 Term Activities.*including archived/);
  await expect(removeTermLearningModule(db, "i", "offering")).rejects.toThrow(ConcurrencyConflictError);
  expect(tx.termActivity.count).toHaveBeenCalledWith({ where: { termLearningModuleId: "offering" } });
  expect(tx.termLearningModule.delete).not.toHaveBeenCalled();
});
it("removes an adoption without Term Activities or Sessions", async () => {
  const { db, tx } = offeringFixture(0);
  await expect(removeTermLearningModule(db, "i", "offering")).resolves.toMatchObject({ id: "offering" });
  expect(tx.termLearningModule.delete).toHaveBeenCalled();
});
it("retains the Session removal blocker", async () => {
  const { db, tx } = offeringFixture(0);
  tx.session.count.mockResolvedValue(3);
  await expect(removeTermLearningModule(db, "i", "offering")).rejects.toThrow(/Sessions/);
});
it("propagates unrelated database errors", async () => {
  const { db, tx } = fixture();
  const error = new DomainInvariantError("unrelated");
  tx.term.create.mockRejectedValue(error);
  await expect(applyTermCreation(db, input)).rejects.toBe(error);
});
it("does not rewrite stored dates on a name-only update", async () => {
  const { db, tx } = fixture();
  await updateTerm(db, "source", { instructorId: "i", name: "Renamed" });
  expect(tx.term.update.mock.calls[0][0].data.startDate).toBeUndefined();
  expect(tx.term.update.mock.calls[0][0].data.endDate).toBeUndefined();
});

it("maps a removal foreign-key race to a conflict", async () => {
  const { db, tx } = offeringFixture(0);
  tx.termLearningModule.delete.mockRejectedValue({ code: "P2003" });
  await expect(removeTermLearningModule(db, "i", "offering")).rejects.toThrow(ConcurrencyConflictError);
});
it("preserves unrelated removal database errors", async () => {
  const { db, tx } = offeringFixture(0);
  const error = { code: "P2025" };
  tx.termLearningModule.delete.mockRejectedValue(error);
  await expect(removeTermLearningModule(db, "i", "offering")).rejects.toBe(error);
});

it("calendar apply preserves retained slot identities and unrelated stored patterns", async () => {
  const { db, tx, term } = calendarFixture();
  const retained = { id: "retained", termId: "source", date: term.startDate };
  tx.calendarSlot.findMany.mockResolvedValue([retained]);
  tx.calendarSlot.update = vi.fn();
  const preview = await previewTermCalendar(db, { instructorId: "i", termId: "source", meetingPatterns: [] });
  await applyTermCalendar(db, { instructorId: "i", termId: "source", meetingPatterns: [], previewToken: preview.previewToken, expectedCurrentCalendarSlotCount: 1 });
  expect(tx.termMeetingPattern.deleteMany).toHaveBeenCalledWith({ where: { termId: "source", activityTypeVersionId: { in: [] } } });
  expect(tx.calendarSlot.deleteMany.mock.calls[0][0].where).toEqual({ termId: "source", date: { notIn: preview.calendarSlotCandidates.map(c => new Date(`${c.date}T00:00:00.000Z`)) } });
  expect(tx.calendarSlot.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "retained" } }));
  expect(tx.calendarSlot.createMany.mock.calls[0][0].data).toHaveLength(399);
});
