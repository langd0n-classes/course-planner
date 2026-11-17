/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { expect, it, vi } from "vitest";
import {
  previewMilestoneDating,
  applyMilestoneDating,
} from "./milestone-dating-service";
const request = { instructorId: "i", termId: "term" };
function fixture() {
  const template = {
    id: "t",
    sequence: 0,
    role: "due",
    label: "Due",
    linkedActivityId: "base-meeting",
    relativeDays: 1,
    defaultTime: "09:00",
    timeZone: "UTC",
  };
  const revision = {
    id: "r",
    baseActivityVersionId: "v",
    title: "Work",
    summary: "Keep",
    courseworkDetail: {
      effortMinMinutes: 15,
      effortMaxMinutes: 30,
      deliveryNotes: "Keep notes",
    },
    baseActivityVersion: { milestoneTemplates: [template] },
    topicActions: [
      { topicVersionId: "topic", action: "practiced", notes: "keep" },
    ],
    milestones: [
      {
        id: "m",
        sourceTemplateId: "t",
        role: "due",
        label: "Due",
        linkedTermActivityId: "meeting",
        anchorPolicy: "follow_activity",
        occursAt: null,
      },
      {
        id: "other",
        role: "review",
        label: "Keep",
        anchorPolicy: "fixed_instant",
        occursAt: new Date("2026-01-01Z"),
      },
    ],
  };
  const row = {
    id: "work",
    activityId: "base-work",
    adoptedLabel: "Practice",
    plannedRevisionId: "r",
    plannedRevision: revision,
    revisions: [{ revision: 4 }],
  };
  const meeting = {
    id: "meeting",
    activityId: "base-meeting",
    adoptedLabel: "Lecture",
    plannedRevisionId: "mr",
    plannedRevision: {
      meetingDetail: {
        startsAt: new Date("2026-03-06T14:00Z"),
        calendarSlotId: null,
      },
      baseActivityVersion: { milestoneTemplates: [] },
      milestones: [],
    },
  };
  const term = { id: "term", status: "active", course: { instructorId: "i" } };
  const tx: any = {
    term: { findUnique: vi.fn(async () => term) },
    termActivity: {
      findMany: vi.fn(async () => [{ ...row, revisions: [] }, meeting]),
      findUnique: vi.fn(async () => row),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    calendarSlot: { findMany: vi.fn(async () => []) },
    termActivityRevision: {
      create: vi.fn(async () => ({ id: "new" })),
      findUnique: vi.fn(async () => ({ id: "new" })),
    },
    termCourseworkActivityRevision: { create: vi.fn() },
    termActivityRevisionTopicAction: { create: vi.fn() },
    termActivityMilestone: { create: vi.fn() },
  };
  const db = {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(tx)),
  };
  return { tx, db, row, meeting, term };
}
it("checks ownership before reading content", async () => {
  const f = fixture();
  f.term.course.instructorId = "other";
  await expect(previewMilestoneDating(f.db, request)).rejects.toThrow(
    "Term not found",
  );
  expect(f.tx.termActivity.findMany).not.toHaveBeenCalled();
});
it("refuses closed Terms for both preview and apply", async () => {
  const f = fixture();
  f.term.status = "closed";
  await expect(previewMilestoneDating(f.db, request)).rejects.toThrow(
    "Closed Terms",
  );
  await expect(
    applyMilestoneDating(f.db, { ...request, previewToken: "old" }),
  ).rejects.toThrow("Closed Terms");
});
it.each(["token", "pointer", "meeting", "template"])(
  "rejects stale %s without writes",
  async (kind) => {
    const f = fixture();
    const p = await previewMilestoneDating(f.db, request);
    if (kind === "pointer") f.row.plannedRevisionId = "changed";
    if (kind === "meeting") f.meeting.plannedRevisionId = "changed";
    if (kind === "template")
      f.row.plannedRevision.baseActivityVersion.milestoneTemplates[0].relativeDays = 2;
    await expect(
      applyMilestoneDating(f.db, {
        ...request,
        previewToken: kind === "token" ? "old" : p.previewToken,
      }),
    ).rejects.toThrow("stale");
    expect(f.tx.termActivityRevision.create).not.toHaveBeenCalled();
  },
);
it("writes one revision, preserving effort, Topic actions and other milestones", async () => {
  const f = fixture();
  const p = await previewMilestoneDating(f.db, request);
  expect(
    await applyMilestoneDating(f.db, {
      ...request,
      previewToken: p.previewToken,
    }),
  ).toEqual({ kind: "applied", datedCount: 1, createdCount: 0 });
  expect(f.tx.termActivityRevision.create).toHaveBeenCalledExactlyOnceWith({
    data: expect.objectContaining({
      revision: 5,
      title: "Work",
      summary: "Keep",
      changeReason: "Milestones dated from linked meetings",
    }),
  });
  expect(f.tx.termCourseworkActivityRevision.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      effortMinMinutes: 15,
      effortMaxMinutes: 30,
      deliveryNotes: "Keep notes",
    }),
  });
  expect(f.tx.termActivityRevisionTopicAction.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ topicVersionId: "topic", notes: "keep" }),
  });
  expect(f.tx.termActivityMilestone.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      label: "Keep",
      occursAt: new Date("2026-01-01Z"),
    }),
  });
  expect(f.tx.termActivity.updateMany).toHaveBeenCalledWith({
    where: { id: "work", plannedRevisionId: "r" },
    data: { plannedRevisionId: "new" },
  });
  expect(f.db.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
    timeout: 300_000,
    maxWait: 30_000,
  });
});
it.each(["reread", "cas", "unique"])("detects a %s race", async (kind) => {
  const f = fixture();
  const p = await previewMilestoneDating(f.db, request);
  if (kind === "reread")
    f.tx.termActivity.findUnique.mockResolvedValue({
      ...f.row,
      plannedRevisionId: "new",
    });
  if (kind === "cas")
    f.tx.termActivity.updateMany.mockResolvedValue({ count: 0 });
  if (kind === "unique")
    f.tx.termActivityRevision.create.mockRejectedValue({ code: "P2002" });
  await expect(
    applyMilestoneDating(f.db, { ...request, previewToken: p.previewToken }),
  ).rejects.toMatchObject({ name: "ConcurrencyConflictError" });
});
it("empty fresh apply succeeds without writes", async () => {
  const f = fixture();
  f.tx.termActivity.findMany.mockResolvedValue([]);
  const p = await previewMilestoneDating(f.db, request);
  expect(
    await applyMilestoneDating(f.db, {
      ...request,
      previewToken: p.previewToken,
    }),
  ).toMatchObject({ datedCount: 0, createdCount: 0 });
  expect(f.tx.termActivityRevision.create).not.toHaveBeenCalled();
});

it("backfills an undated milestone whose linked meeting has no planned revision yet", async () => {
  const f = fixture();
  f.row.plannedRevision.milestones = [];
  f.meeting.plannedRevision = null as any;
  (f.meeting as any).activityTypeVersion = {
    activityType: { behaviorFamily: "meeting" },
  };
  const p = await previewMilestoneDating(f.db, request);
  expect(p.creates).toHaveLength(1);
  expect(p.undated[0].reason).toBe("linked_meeting_undated");
});

it("does not backfill when an earlier revision had a template milestone", async () => {
  const f = fixture();
  f.row.plannedRevision.milestones = [];
  f.tx.termActivity.findMany.mockResolvedValue([f.row, f.meeting]);
  const result = await previewMilestoneDating(f.db, request);
  expect(result.creates).toEqual([]);
});
it.each(["stale token", "changed Activity"])(
  "leaves persisted state unchanged for %s",
  async (kind) => {
    const f = fixture();
    const before = structuredClone(f.row);
    const p = await previewMilestoneDating(f.db, request);
    if (kind === "changed Activity") {
      f.tx.termActivity.findUnique.mockResolvedValue({
        ...f.row,
        plannedRevisionId: "concurrent",
      });
    }
    await expect(
      applyMilestoneDating(f.db, {
        ...request,
        previewToken: kind === "stale token" ? "stale" : p.previewToken,
      }),
    ).rejects.toMatchObject({ name: "ConcurrencyConflictError" });
    expect(f.row).toEqual(before);
    for (const model of [
      f.tx.termActivityRevision,
      f.tx.termCourseworkActivityRevision,
      f.tx.termActivityRevisionTopicAction,
      f.tx.termActivityMilestone,
    ])
      expect(model.create).not.toHaveBeenCalled();
    expect(f.tx.termActivity.updateMany).not.toHaveBeenCalled();
  },
);
