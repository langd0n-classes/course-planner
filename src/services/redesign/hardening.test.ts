/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it, vi } from "vitest";
import { applyTermCreation, previewTermCreation, updateTerm } from "./term-service";
import { applyTermClone, previewTermClone } from "./clone-service";
import { previewCalendarMaterialization } from "./calendar-materialization-service";
import { applyTermCalendar, previewTermCalendar } from "./academic-calendar-service";
import { previewTermLearningModuleRemoval, removeTermLearningModule } from "./offering-service";
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
    ["equal dates", { endDate: input.startDate }, /after/],
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
  tx.term.create.mockRejectedValue({ code: "P2002" });
  tx.term.update.mockRejectedValue({ code: "P2002" });
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
it("bounds calendar materialization before reading events", async () => {
  const { tx } = fixture();
  await expect(previewCalendarMaterialization(tx, { ...input, endDate: new Date("2030-01-01") })).rejects.toThrow(/400 days/);
  expect(tx.academicCalendarEvent.findMany).not.toHaveBeenCalled();
});
it("bounds adopted calendar preview before building dates", async () => {
  const { db, term } = fixture();
  term.endDate = new Date("2030-01-01");
  await expect(previewTermCalendar(db, { instructorId: "i", termId: "source", meetingPatterns: [] })).rejects.toThrow(/400 days/);
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
  const preview = await previewTermLearningModuleRemoval(db, "i", "offering");
  expect(preview).toMatchObject({ canRemove: false, blockers: [{ code: "term_activities", count: 2, message: expect.stringContaining("Term Activities") }] });
  await expect(removeTermLearningModule(db, "i", "offering")).rejects.toThrow(preview.blockers[0].message);
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
  await expect(previewTermLearningModuleRemoval(db, "i", "offering")).resolves.toMatchObject({ canRemove: false, blockers: [{ code: "sessions", count: 3 }] });
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
