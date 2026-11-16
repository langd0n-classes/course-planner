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
  const term = { id: "term", status: "active", course: { instructorId: "i" } };
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
    termMeetingPattern: { findMany: vi.fn(async () => []) },
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
  });
  it("rejects stale tokens", async () => {
    const f = fixture();
    await expect(
      applyMeetingPlacement(f.db, { ...request, previewToken: "old" }),
    ).rejects.toThrow("stale");
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
    ).toEqual({ kind: "applied", placedCount: 1 });
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
