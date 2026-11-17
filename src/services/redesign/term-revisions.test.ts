/* eslint-disable @typescript-eslint/no-explicit-any -- structural transaction fixtures */
import { describe, expect, it, vi } from "vitest";
import { applyTermActivityRevision, previewTermActivityRevision, createRevisionSnapshot, applyTermActivityAdoption } from "./term-activity-service";
import { createDeliveredRevision } from "./offering-service";
import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import { buildTermDailyDriver } from "@/lib/redesign-workspace";

function fixture() {
  const milestone = { role: "due", label: "Due", anchorPolicy: "standalone", occursAt: new Date("2026-11-20T12:00:00Z") };
  const planned = { id: "p", topicActions: [{ topicVersionId: "topic", action: "introduced" }], milestones: [milestone] };
  const delivered = { id: "d", topicActions: [], milestones: [] };
  const row = { id: "a", termId: "t", plannedActivityVersionId: "v", plannedRevisionId: "p", deliveredRevisionId: "d", plannedRevision: planned, deliveredRevision: delivered, plannedActivityVersion: {}, revisions: [{ revision: 2 }], term: { status: "active", courseId: "c", course: { instructorId: "i" } } };
  const tx: any = {
    termActivity: { findUnique: vi.fn(async () => row), updateMany: vi.fn(async () => ({ count: 1 })) },
    topicVersion: { findUnique: vi.fn(async () => ({ topic: { courseId: "c", course: { instructorId: "i" } } })) },
    activityVersionMilestoneTemplate: { findUnique: vi.fn(async () => null) },
    termActivityRevision: { create: vi.fn(async () => ({ id: "new" })), findUnique: vi.fn(async () => ({ id: "new" })) },
    termMeetingActivityRevision: { create: vi.fn() },
    termActivityRevisionTopicAction: { create: vi.fn() }, termActivityMilestone: { create: vi.fn() },
  };
  const db = { $transaction: async (fn: any) => fn(tx) };
  const input = { instructorId: "i", termActivityId: "a", advancePointer: "planned" as const, draft: { title: "Edit", detail: { behaviorFamily: "meeting" as const, status: "canceled" } } };
  return { tx, db, row, input, milestone };
}
describe("revision corrections", () => {
  it("preserves omitted lists in preview and apply, without changing delivered identity state", async () => {
    const f = fixture();
    const p = await previewTermActivityRevision(f.db, f.input);
    expect(p.proposedRevision.milestones).toHaveLength(1);
    expect(p.proposedRevision.topicActions).toHaveLength(1);
    await applyTermActivityRevision(f.db, { ...f.input, previewToken: p.previewToken, expectedCurrentRevisionId: "p" });
    expect(f.tx.termActivityMilestone.create).toHaveBeenCalledOnce();
    expect(f.tx.termActivityRevisionTopicAction.create).toHaveBeenCalledOnce();
    expect(f.tx.termActivity.updateMany.mock.calls[0][0].data).toEqual({ plannedRevisionId: "new" });
  });
  it("explicit empty lists remove both collections", async () => {
    const f = fixture();
    f.input.draft = { ...f.input.draft, ...{ milestones: [], topicActions: [] } };
    const p = await previewTermActivityRevision(f.db, f.input);
    expect(p.proposedRevision.milestones).toEqual([]);
    expect(p.proposedRevision.topicActions).toEqual([]);
  });
  it.each([
    { anchorPolicy: "follow_activity" },
    { anchorPolicy: "standalone" },
    { anchorPolicy: "fixed_instant" },
    { anchorPolicy: "follow_activity", linkedTermActivityId: "a" },
    { anchorPolicy: "follow_activity", linkedTermActivityId: "other" },
    { anchorPolicy: "standalone", occursAt: new Date(), sourceTemplateId: "unknown" },
  ])("rejects invalid milestones before writing: %j", async (fields) => {
    const f = fixture();
    f.tx.termActivity.findUnique.mockImplementation(async ({ where }: any) => where.id === "other" ? { ...f.row, id: "other", termId: "other-term" } : f.row);
    await expect(createRevisionSnapshot(f.tx, { termActivityId: "a", baseActivityVersionId: "v", revision: 3, title: "Edit", summary: null, createdByInstructorId: "i", detail: f.input.draft.detail, topicActions: [], milestones: [{ role: "due", label: "Due", ...fields }] as any })).rejects.toBeInstanceOf(DomainInvariantError);
    expect(f.tx.termActivityRevision.create).not.toHaveBeenCalled();
  });
  it("maps adoption unique races to conflict", async () => {
    await expect(applyTermActivityAdoption({ $transaction: async () => { throw { code: "P2002" }; } } as any, {} as any)).rejects.toBeInstanceOf(ConcurrencyConflictError);
  });
  it.each(["cas", "unique"])("guards delivered module races: %s", async (race) => {
    const offering = { id: "o", learningModuleId: "lm", courseId: "c", deliveredLearningModuleVersionId: "old", term: { status: "active", course: { instructorId: "i" } } };
    const tx: any = {
      termLearningModule: { findUnique: vi.fn(async () => offering), updateMany: vi.fn(async () => ({ count: 0 })) },
      learningModule: { findUnique: async () => ({ id: "lm", courseId: "c" }) },
      course: { findUnique: async () => ({ instructorId: "i" }) },
      learningModuleVersion: { findFirst: async () => ({ revision: 1 }), create: async () => { if (race === "unique") throw { code: "P2002" }; return { id: "new" }; } },
    };
    await expect(createDeliveredRevision({ $transaction: async (fn: any) => fn(tx) }, { instructorId: "i", termLearningModuleId: "o", expectedDeliveredLearningModuleVersionId: "old", draft: { title: "New" } })).rejects.toBeInstanceOf(ConcurrencyConflictError);
    if (race === "cas") expect(tx.termLearningModule.updateMany).toHaveBeenCalledWith({ where: { id: "o", deliveredLearningModuleVersionId: "old" }, data: { deliveredLearningModuleVersionId: "new" } });
  });
});

it("daily driver skips canceled and archived meetings and uses the Term local date", () => {
  const revision = (startsAt: string, status = "scheduled") => ({ id: startsAt, detail: { behaviorFamily: "meeting", startsAt, status }, topicActions: [], milestones: [] });
  const result = buildTermDailyDriver({ today: "2026-11-17", timeZone: "America/New_York", termActivities: [{ id: "cancel", archivedAt: null }, { id: "archive", archivedAt: "yes" }, { id: "evening", archivedAt: null }], revisionsByTermActivityId: { cancel: { planned: revision("2026-11-17T12:00:00Z", "canceled") }, archive: { planned: revision("2026-11-17T13:00:00Z") }, evening: { planned: revision("2026-11-17T01:00:00Z") } } } as any);
  expect(result.totalMeetings).toBe(1);
  expect(result.nextMeeting).toBeNull(); // Evening of Nov 16, already past locally.
});

it("keeps an evening meeting in today's local date after UTC midnight", () => {
  const meeting: any = { id: "evening", archivedAt: null };
  const revision: any = { id: "r", detail: { behaviorFamily: "meeting", startsAt: "2026-11-18T01:00:00Z", status: "scheduled" }, topicActions: [], milestones: [] };
  const result = buildTermDailyDriver({ today: "2026-11-17", timeZone: "America/New_York", termActivities: [meeting], revisionsByTermActivityId: { evening: { planned: revision, delivered: null } } });
  expect(result.nextMeeting?.activity.id).toBe("evening");
});

it("preview rejects a follow anchor outside the Term with a validation error", async () => {
  const f = fixture();
  f.tx.termActivity.findUnique.mockImplementation(async ({ where }: any) => where.id === "other" ? { ...f.row, id: "other", termId: "other-term" } : f.row);
  const draft = { ...f.input.draft, milestones: [{ role: "due" as const, label: "Due", linkedTermActivityId: "other", anchorPolicy: "follow_activity" as const }] };
  await expect(previewTermActivityRevision(f.db, { ...f.input, draft })).rejects.toMatchObject({ name: "DomainInvariantError", message: "The linked Term Activity must be in the same Term" });
});

it("rejects templates of another base version in preview", async () => {
  const f = fixture();
  f.tx.activityVersionMilestoneTemplate.findUnique.mockResolvedValue({ id: "template", activityVersionId: "another-version" });
  await expect(previewTermActivityRevision(f.db, { ...f.input, draft: { ...f.input.draft, milestones: [{ ...f.milestone, anchorPolicy: "standalone", role: "due", sourceTemplateId: "template" }] } })).rejects.toThrow("The milestone template must belong to the base Activity version");
});

it("rejects a revision detail from another Activity family", async () => {
  const f = fixture();
  f.row.plannedActivityVersion = { meetingDetail: {} };
  await expect(previewTermActivityRevision(f.db, { ...f.input, draft: { title: "Wrong", detail: { behaviorFamily: "coursework" } } })).rejects.toThrow("family");
});
it("can cancel a revision with an inherited legacy self-link but rejects one supplied anew", async () => {
  const f = fixture();
  Object.assign(f.milestone, { linkedTermActivityId: "a", anchorPolicy: "follow_activity" });
  const p = await previewTermActivityRevision(f.db, f.input);
  await applyTermActivityRevision(f.db, { ...f.input, previewToken: p.previewToken, expectedCurrentRevisionId: "p" });
  expect(f.tx.termActivityMilestone.create).toHaveBeenCalled();
  await expect(previewTermActivityRevision(f.db, { ...f.input, draft: { ...f.input.draft, milestones: [{ ...f.milestone, label: "New self link" } as any] } })).rejects.toThrow("own Term Activity");
});
it("uses the browser zone without a Term pattern", () => {
  const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ timeZone: "America/New_York" } as any);
  try {
    const result = buildTermDailyDriver({ today: "2026-11-17", termActivities: [{ id: "a" }], revisionsByTermActivityId: { a: { planned: { detail: { behaviorFamily: "meeting", startsAt: "2026-11-17T01:00Z" }, topicActions: [], milestones: [] } } } } as any);
    expect(result.nextMeeting).toBeNull();
  } finally { spy.mockRestore(); }
});
it.each([true, false])("updates slot identity at the server revision boundary: %s", async matching => {
  const f = fixture();
  Object.assign(f.row.plannedRevision, { meetingDetail: { startsAt: new Date("2026-11-17T14:00Z"), calendarSlotId: "old" } });
  f.tx.termMeetingPattern = { findMany: async () => [{ timeZone: "America/New_York" }] };
  f.tx.calendarSlot = { findUnique: async () => ({ termId: "t", term: { course: { instructorId: "i" } } }), findFirst: vi.fn(async () => matching ? { id: "new-slot" } : null) };
  const p = await previewTermActivityRevision(f.db, { ...f.input, draft: { title: "Move", detail: { behaviorFamily: "meeting", startsAt: new Date("2026-11-19T01:00Z"), calendarSlotId: "old" } } });
  expect(p.proposedRevision.meetingDetail?.calendarSlotId).toBe(matching ? "new-slot" : null);
  expect(f.tx.calendarSlot.findFirst).toHaveBeenCalledWith({ where: { termId: "t", date: new Date("2026-11-18T00:00Z") } });
});
it("keeps advisory daily-driver fallback for an invalid legacy milestone zone", () => {
  const result = buildTermDailyDriver({ today: "2026-11-17", timeZone: "America/New_York", termActivities: [{ id: "a" }], revisionsByTermActivityId: { a: { planned: { detail: { behaviorFamily: "coursework" }, topicActions: [], milestones: [{ label: "Due", occursAt: "2026-11-17T23:00Z", timeZone: "Invalid/Zone" }] } } } } as any);
  expect(result.nextMilestone?.label).toBe("Due");
});

it.each(["id", "fields"])("accepts a supplied inherited legacy self-link by %s through preview and apply", async match => {
  const f = fixture();
  Object.assign(f.milestone, { id: "legacy", linkedTermActivityId: "a", anchorPolicy: "follow_activity" });
  const supplied = match === "id" ? { ...f.milestone, label: "Updated existing milestone" } : { role: "due", label: "Due", anchorPolicy: "follow_activity", linkedTermActivityId: "a", occursAt: "2026-11-20T12:00:00.000Z" };
  const input = { ...f.input, draft: { ...f.input.draft, milestones: [supplied as any] } };
  const preview = await previewTermActivityRevision(f.db, input);
  await applyTermActivityRevision(f.db, { ...input, previewToken: preview.previewToken, expectedCurrentRevisionId: "p" });
  expect(f.tx.termActivityMilestone.create).toHaveBeenCalledOnce();
});
it.each(["own", "fallback", "UTC"])("normalizes slots using the %s pattern zone", async mode => {
  const f = fixture();
  Object.assign(f.row, { activityTypeVersionId: "lab" });
  f.tx.termMeetingPattern = { findMany: async () => mode === "UTC" ? [] : [
    { activityTypeVersionId: "lecture", timeZone: "America/New_York" },
    ...(mode === "own" ? [{ activityTypeVersionId: "lab", timeZone: "Asia/Tokyo" }] : []),
  ] };
  f.tx.calendarSlot = { findFirst: vi.fn(async () => null) };
  await previewTermActivityRevision(f.db, { ...f.input, draft: { title: "Move", detail: { behaviorFamily: "meeting", startsAt: new Date("2026-11-19T01:00Z") } } });
  expect(f.tx.calendarSlot.findFirst).toHaveBeenCalledWith({ where: { termId: "t", date: new Date(mode === "fallback" ? "2026-11-18T00:00Z" : "2026-11-19T00:00Z") } });
});
