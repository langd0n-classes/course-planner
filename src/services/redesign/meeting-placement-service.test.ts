/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it, vi } from "vitest";
import {
  applyMeetingPlacement,
  previewMeetingPlacement,
} from "./meeting-placement-service";

import { createRevisionSnapshot } from "./term-activity-service";
import { toTermActivityRevisionDto } from "@/lib/redesign-serializers";

const request = {
  instructorId: "i",
  termId: "term",
  defaultMeetingTime: {
    startTimeLocal: "09:00",
    endTimeLocal: null,
    timeZone: "America/New_York",
  },
};
function fixture() {
  const revision = {
    id: "r",
    revision: 2,
    baseActivityVersionId: "v",
    title: "Title",
    summary: "Summary",
    meetingDetail: {
      status: "scheduled",
      calendarSlotId: null,
      startsAt: null,
      endsAt: null,
      modality: "online",
      overrideReason: null,
      overrideEvidence: null,
    },
    topicActions: [
      {
        topicVersionId: "topic",
        action: "introduced",
        notes: "keep",
        provenance: null,
      },
    ],
    milestones: [
      {
        role: "other",
        label: "Keep",
        anchorPolicy: "fixed",
        occursAt: null,
        timeZone: null,
      },
    ],
  };
  const row = {
    id: "a",
    activityTypeVersionId: "type",
    adoptedLabel: "Lecture",
    termLearningModule: { sequence: 1 },
    ordinal: 1,
    createdAt: new Date(),
    plannedRevisionId: "r",
    plannedRevision: revision,
    plannedActivityVersion: { meetingDetail: { defaultDurationMinutes: 50 } },
    revisions: [{ revision: 5 }],
  };
  const term = { startDate: new Date("2026-03-01"), endDate: new Date("2026-03-31"), id: "term", status: "active", course: { instructorId: "i" } };
  const tx: Record<string, any> = {
    term: { findUnique: vi.fn(async () => term) },
    termActivity: {
      findMany: vi.fn(async () => [row]),
      findUnique: vi.fn(async () => row),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    calendarSlot: {
      findMany: vi.fn(async () => [
        { id: "s", date: new Date("2026-03-06"), slotType: "class_day" },
      ]),
    },
    termMeetingPattern: { findMany: vi.fn(async () => []), create: vi.fn() },
    termCalendarException: { findMany: vi.fn(async () => []) },
    termActivityRevision: {
      create: vi.fn(async () => ({ id: "new" })),
      findUnique: vi.fn(async () => ({ id: "new" })),
    },
    termMeetingActivityRevision: { create: vi.fn() },
    termActivityRevisionTopicAction: { create: vi.fn() },
    termActivityMilestone: { create: vi.fn() },
  };
  const db = {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(tx)),
  };
  return { tx, db, row, term };
}
describe("meeting placement service", () => {
  it("checks ownership before loading meetings", async () => {
    const f = fixture();
    f.term.course.instructorId = "other";
    await expect(previewMeetingPlacement(f.db, request)).rejects.toThrow(
      "Term not found",
    );
    expect(f.tx.termActivity.findMany).not.toHaveBeenCalled();
  });
  it("rejects a closed Term", async () => {
    const f = fixture();
    f.term.status = "closed";
    await expect(
      applyMeetingPlacement(f.db, { ...request, previewToken: "old" }),
    ).rejects.toThrow("Closed Terms are read-only");
    expect(f.tx.termMeetingPattern.create).not.toHaveBeenCalled();
  });
  it("rejects stale tokens", async () => {
    const f = fixture();
    await expect(
      applyMeetingPlacement(f.db, { ...request, previewToken: "old" }),
    ).rejects.toThrow("stale");
    expect(f.tx.termMeetingPattern.create).not.toHaveBeenCalled();
    expect(f.tx.termActivityRevision.create).not.toHaveBeenCalled();
  });
  it("detects a meeting changed since preview", async () => {
    const f = fixture();
    const preview = await previewMeetingPlacement(f.db, request);
    f.row.plannedRevisionId = "changed";
    await expect(
      applyMeetingPlacement(f.db, {
        ...request,
        previewToken: preview.previewToken,
      }),
    ).rejects.toThrow("stale");
    expect(f.tx.termMeetingPattern.create).not.toHaveBeenCalled();
  });
  it("copies the snapshot, increments the highest revision and compares the pointer", async () => {
    const f = fixture();
    const preview = await previewMeetingPlacement(f.db, request);
    expect(preview.placements[0].adoptedLabel).toBe("Lecture");
    expect(
      await applyMeetingPlacement(f.db, {
        ...request,
        previewToken: preview.previewToken,
      }),
    ).toEqual({ kind: "applied", placedCount: 1, storedMeetingPatternCount: 1 });
    expect(f.tx.termActivityRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Title",
        summary: "Summary",
        revision: 6,
        changeReason: "Placed on the Term calendar",
      }),
    });
    expect(f.tx.termActivity.updateMany).toHaveBeenCalledWith({
      where: { id: "a", plannedRevisionId: "r" },
      data: { plannedRevisionId: "new" },
    });
    expect(f.tx.termActivityMilestone.create).toHaveBeenCalled();
    expect(f.tx.termActivityRevisionTopicAction.create).toHaveBeenCalled();
    expect(f.db.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      timeout: 300_000,
      maxWait: 30_000,
    });
  });
  it("never creates a revision for a dated meeting", async () => {
    const f = fixture();
    const dated = {
      ...f.row,
      id: "dated",
      plannedRevision: {
        ...f.row.plannedRevision,
        meetingDetail: {
          ...f.row.plannedRevision.meetingDetail,
          calendarSlotId: "other",
        },
      },
    };
    f.tx.termActivity.findMany.mockResolvedValue([f.row, dated]);
    const preview = await previewMeetingPlacement(f.db, request);
    expect(preview.alreadyDatedCount).toBe(1);
    await applyMeetingPlacement(f.db, {
      ...request,
      previewToken: preview.previewToken,
    });
    expect(f.tx.termActivityRevision.create).toHaveBeenCalledTimes(1);
  });
  it.each(["pointer", "unique"])("maps a %s conflict", async (kind) => {
    const f = fixture();
    const preview = await previewMeetingPlacement(f.db, request);
    if (kind === "pointer")
      f.tx.termActivity.updateMany.mockResolvedValue({ count: 0 });
    else f.tx.termActivityRevision.create.mockRejectedValue({ code: "P2002" });
    await expect(
      applyMeetingPlacement(f.db, {
        ...request,
        previewToken: preview.previewToken,
      }),
    ).rejects.toMatchObject({ name: "ConcurrencyConflictError" });
  });
  it("rejects a preview with missing meeting time or no placements", async () => {
    const f = fixture();
    const noTime = { ...request, defaultMeetingTime: null };
    const preview = await previewMeetingPlacement(f.db, noTime);
    await expect(
      applyMeetingPlacement(f.db, {
        ...noTime,
        previewToken: preview.previewToken,
      }),
    ).rejects.toThrow("meeting time");
    f.tx.termActivity.findMany.mockResolvedValue([]);
    const empty = await previewMeetingPlacement(f.db, request);
    await expect(
      applyMeetingPlacement(f.db, {
        ...request,
        previewToken: empty.previewToken,
      }),
    ).rejects.toThrow("No meetings");
  });
});
it("loads only non-archived meeting activities and resolves calendar exceptions", async () => {
  const f = fixture();
  f.tx.termCalendarException.findMany.mockResolvedValue([
    {
      activityTypeVersionId: null,
      targetDate: null,
      startsAt: null,
      calendarSlot: { date: new Date("2026-03-06") },
    },
  ]);
  const preview = await previewMeetingPlacement(f.db, request);
  expect(preview.placements).toEqual([]);
  expect(f.tx.termActivity.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        termId: "term",
        archivedAt: null,
        activityTypeVersion: { activityType: { behaviorFamily: "meeting" } },
      },
    }),
  );
});

it("stores one pattern per placed type with all distinct class weekdays in calendar order", async () => {
  const f = fixture();
  const rows = [f.row, { ...f.row, id: "b", ordinal: 2 }, { ...f.row, id: "c", activityTypeVersionId: "lab" }];
  f.tx.termActivity.findMany.mockResolvedValue([...rows, { ...f.row, id: "unplaced", activityTypeVersionId: "unused", termLearningModule: null }]);
  f.tx.termActivity.findUnique.mockImplementation(async ({ where }: any) => rows.find(r => r.id === where.id));
  f.tx.calendarSlot.findMany.mockResolvedValue([
    { id: "fri", date: new Date("2026-03-06"), slotType: "class_day" },
    { id: "mon", date: new Date("2026-03-09"), slotType: "class_day" },
    { id: "fri2", date: new Date("2026-03-13"), slotType: "class_day" },
    { id: "holiday", date: new Date("2026-03-10"), slotType: "holiday" },
  ]);
  const input = { ...request, defaultMeetingTime: { ...request.defaultMeetingTime, endTimeLocal: "10:00" } };
  const preview = await previewMeetingPlacement(f.db, input);
  const result = await applyMeetingPlacement(f.db, { ...input, previewToken: preview.previewToken });
  expect(result.storedMeetingPatternCount).toBe(2);
  expect(f.tx.termMeetingPattern.create).toHaveBeenCalledTimes(2);
  for (const activityTypeVersionId of ["type", "lab"]) {
    expect(f.tx.termMeetingPattern.create).toHaveBeenCalledWith({ data: {
      termId: "term", activityTypeVersionId, label: null,
      daysOfWeek: ["monday", "friday"], ...input.defaultMeetingTime,
      startsOn: f.term.startDate, endsOn: f.term.endDate,
    } });
  }
  expect(f.tx.termMeetingPattern.create.mock.invocationCallOrder[0]).toBeGreaterThan(f.tx.termActivity.updateMany.mock.invocationCallOrder.at(-1));
});
it("preserves an existing pattern and reports zero stored patterns", async () => {
  const f = fixture();
  const pattern = { id: "existing", activityTypeVersionId: "type", daysOfWeek: ["friday"], startsOn: f.term.startDate, endsOn: f.term.endDate, ...request.defaultMeetingTime };
  f.tx.termMeetingPattern.findMany.mockResolvedValue([pattern]);
  const input = { ...request, defaultMeetingTime: null };
  const preview = await previewMeetingPlacement(f.db, input);
  expect(await applyMeetingPlacement(f.db, { ...input, previewToken: preview.previewToken })).toEqual({ kind: "applied", placedCount: 1, storedMeetingPatternCount: 0 });
  expect(f.tx.termMeetingPattern.create).not.toHaveBeenCalled();
  await expect(f.tx.termMeetingPattern.findMany.mock.results[0].value).resolves.toEqual([pattern]);
});
it("reuses the saved time for a remaining undated meeting without a fallback", async () => {
  const f = fixture();
  const first = await previewMeetingPlacement(f.db, request);
  f.tx.termMeetingPattern.create.mockImplementation(async ({ data }: any) => {
    f.tx.termMeetingPattern.findMany.mockResolvedValue([{ id: "saved", ...data }]);
  });
  await applyMeetingPlacement(f.db, { ...request, previewToken: first.previewToken });
  // A later adopted meeting uses the same available slot and saved time.
  const remaining = { ...f.row, id: "remaining" };
  f.tx.termActivity.findMany.mockResolvedValue([remaining]);
  const withFallback = await previewMeetingPlacement(f.db, request);
  const saved = await previewMeetingPlacement(f.db, { ...request, defaultMeetingTime: null });
  expect(saved.missingMeetingTime).toBe(false);
  expect(saved.placements).toEqual(withFallback.placements);
  expect(saved.placements[0]).toMatchObject({ calendarSlotId: first.placements[0].calendarSlotId, startsAt: first.placements[0].startsAt, endsAt: first.placements[0].endsAt });
});


it.each(["coursework", "assessment"] as const)("keeps a %s effort override when placing meetings", async (behaviorFamily) => {
  const f = fixture();
  const detailRows: any[] = [];
  const detailModel = behaviorFamily === "coursework" ? "termCourseworkActivityRevision" : "termAssessmentActivityRevision";
  f.tx[detailModel] = { create: vi.fn(async ({ data }: any) => { detailRows.push(data); return data; }) };
  const baseDetail = { effortMinMinutes: 60, effortMaxMinutes: 120 };
  const revision = {
    id: "effort-revision", termActivityId: "work", baseActivityVersionId: "work-version",
    revision: 1, title: "Work", summary: null, changeReason: null,
    createdByInstructorId: "i", createdAt: new Date(),
    baseActivityVersion: { [`${behaviorFamily}Detail`]: baseDetail },
    [`${behaviorFamily}Detail`]: { effortMinMinutes: 30, effortMaxMinutes: 45 },
  };
  f.tx.termActivityRevision.findUnique.mockResolvedValue(revision);
  const saved = await createRevisionSnapshot(f.tx, {
    termActivityId: "work", baseActivityVersionId: "work-version", revision: 1,
    title: "Work", summary: null, createdByInstructorId: "i",
    detail: { behaviorFamily, effortMinMinutes: 30, effortMaxMinutes: 45 },
    topicActions: [], milestones: [],
  });
  expect(toTermActivityRevisionDto(saved).effectiveEffort).toEqual({ minMinutes: 30, maxMinutes: 45 });
  const preview = await previewMeetingPlacement(f.db, request);
  await applyMeetingPlacement(f.db, { ...request, previewToken: preview.previewToken });
  expect(f.tx[detailModel].create).toHaveBeenCalledTimes(1);
  expect(detailRows).toEqual([expect.objectContaining({ effortMinMinutes: 30, effortMaxMinutes: 45 })]);
  expect(toTermActivityRevisionDto(saved).effectiveEffort).toEqual({ minMinutes: 30, maxMinutes: 45 });
  expect(f.tx.termActivity.updateMany).toHaveBeenCalledTimes(1);
  expect(f.tx.termActivity.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "a", plannedRevisionId: "r" } }));
});
