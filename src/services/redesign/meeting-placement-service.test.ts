/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it, vi } from "vitest";
import {
  applyMeetingPlacement,
  previewMeetingPlacement,
} from "./meeting-placement-service";


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
      where: { id: "a", plannedRevisionId: "r", deliveredRevisionId: null },
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


it("writes only meeting revisions and leaves coursework and assessment effort unchanged", async () => {
  const f = fixture();
  const nonMeetings = ["coursework", "assessment"].map((family) => ({
    ...f.row,
    id: family,
    termId: "term",
    plannedRevisionId: `${family}-revision`,
    plannedRevision: {
      id: `${family}-revision`,
      [`${family}Detail`]: { effortMinMinutes: 30, effortMaxMinutes: 45 },
    },
    plannedActivityVersion: { [`${family}Detail`]: { effortMinMinutes: 60, effortMaxMinutes: 120 } },
  }));
  const before = structuredClone(nonMeetings);
  f.tx.termCourseworkActivityRevision = { create: vi.fn(), update: vi.fn() };
  f.tx.termAssessmentActivityRevision = { create: vi.fn(), update: vi.fn() };
  // Include other families to exercise placement's meeting filter as well as its query.
  f.tx.termActivity.findMany.mockResolvedValue([f.row, ...nonMeetings]);
  f.tx.termActivity.findUnique.mockImplementation(async ({ where }: any) =>
    [f.row, ...nonMeetings].find((row) => row.id === where.id));
  const preview = await previewMeetingPlacement(f.db, request);
  await applyMeetingPlacement(f.db, { ...request, previewToken: preview.previewToken });
  expect(f.tx.termActivityRevision.create).toHaveBeenCalledTimes(1);
  expect(f.tx.termActivityRevision.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ termActivityId: "a" }),
  });
  expect(f.tx.termMeetingActivityRevision.create).toHaveBeenCalledTimes(1);
  expect(f.tx.termActivity.updateMany).toHaveBeenCalledTimes(1);
  expect(f.tx.termActivity.updateMany).toHaveBeenCalledWith({
    where: { id: "a", plannedRevisionId: "r", deliveredRevisionId: null }, data: { plannedRevisionId: "new" },
  });
  for (const model of [f.tx.termCourseworkActivityRevision, f.tx.termAssessmentActivityRevision]) {
    expect(model.create).not.toHaveBeenCalled();
    expect(model.update).not.toHaveBeenCalled();
  }
  expect(nonMeetings).toEqual(before);
});

it.each(["canceled", "delivered", "moved"])("uses delivered %s details and never revises that meeting", async (status) => {
  const f = fixture();
  (f.row as any).deliveredRevisionId = "delivered";
  (f.row as any).deliveredRevision = { meetingDetail: { status, startsAt: status === "moved" ? new Date("2026-03-06T14:00:00Z") : null, calendarSlotId: status === "moved" ? "s" : null } };
  const p = await previewMeetingPlacement(f.db, request);
  expect(p.placements).toEqual([]);
  expect(p.emptySlots).toHaveLength(status === "moved" ? 0 : 1);
  await expect(applyMeetingPlacement(f.db, { ...request, previewToken: p.previewToken })).rejects.toThrow("No meetings can be placed");
  expect(f.tx.termActivityRevision.create).not.toHaveBeenCalled();
});
it("keeps an unconfirmed past meeting in its planned slot", async () => {
  const f = fixture();
  f.row.plannedRevision.meetingDetail.calendarSlotId = "s" as any;
  const p = await previewMeetingPlacement(f.db, request);
  expect(p.placements).toEqual([]);
  expect(p.emptySlots).toEqual([]);
});

it("delivered moves hold the new slot and make the old planned slot available", async () => {
  const f = fixture();
  const moved = { ...f.row, id: "moved", plannedRevision: { ...f.row.plannedRevision, meetingDetail: { ...f.row.plannedRevision.meetingDetail, calendarSlotId: "s" } }, deliveredRevisionId: "d", deliveredRevision: { meetingDetail: { status: "delivered", calendarSlotId: "new-slot", startsAt: new Date("2026-03-09T13:00:00Z") } } };
  f.tx.termActivity.findMany.mockResolvedValue([moved, f.row]);
  f.tx.calendarSlot.findMany.mockResolvedValue([{ id: "s", date: new Date("2026-03-06"), slotType: "class_day" }, { id: "new-slot", date: new Date("2026-03-09"), slotType: "class_day" }]);
  const p = await previewMeetingPlacement(f.db, request);
  expect(p.placements.map(item => [item.termActivityId, item.calendarSlotId])).toEqual([["a", "s"]]);
  expect(p.emptySlots).toEqual([]);
});
it("delivered cancellations release their planned slot for another meeting", async () => {
  const f = fixture();
  const canceled = { ...f.row, id: "canceled", plannedRevision: { ...f.row.plannedRevision, meetingDetail: { ...f.row.plannedRevision.meetingDetail, calendarSlotId: "s" } }, deliveredRevisionId: "d", deliveredRevision: { meetingDetail: { status: "canceled", calendarSlotId: "s", startsAt: null } } };
  f.tx.termActivity.findMany.mockResolvedValue([canceled, f.row]);
  const p = await previewMeetingPlacement(f.db, request);
  expect(p.placements.map(item => item.termActivityId)).toEqual(["a"]);
  await applyMeetingPlacement(f.db, { ...request, previewToken: p.previewToken });
  expect(f.tx.termActivityRevision.create).toHaveBeenCalledOnce();
});
