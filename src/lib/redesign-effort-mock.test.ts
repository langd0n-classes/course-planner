import { beforeEach, expect, it } from "vitest";
import * as mock from "./redesign-mock-backend";
beforeEach(() => mock.resetMockBackend());
it("round-trips Course vocabulary and immutable Activity effort through the mock", async () => {
  const course = mock.listCourses()[1];
  const size = mock.createCourseEffortSize(course.id, {
    label: " Small ",
    minMinutes: 30,
    maxMinutes: 45,
  });
  expect(mock.listCourseEffortSizes(course.id)[0]).toMatchObject({
    label: "Small",
  });
  const kind = mock.createCourseEffortPartKind(course.id, { label: "Read" });
  const activity = await mock.createCourseActivity(course.id, {
    stableCode: "a",
    version: {
      title: "A",
      activityTypeVersionId: "type",
      detail: {
        behaviorFamily: "coursework",
        submissionPolicy: null,
        releasePolicy: null,
        authoringNotes: null,
      },
      effortParts: [
        {
          sequence: 0,
          label: "Read",
          partKindId: kind.id,
          minMinutes: 10,
          maxMinutes: 20,
        },
      ],
    },
  });
  expect(activity.currentVersion.detail).toMatchObject({
    effortMinMinutes: 10,
    effortMaxMinutes: 20,
  });
  const revised = await mock.createActivityVersion(activity.activity.id, {
    ...activity.currentVersion,
    expectedCurrentVersionId: activity.currentVersion.id,
  });
  expect(revised.effortParts).toEqual(activity.currentVersion.effortParts);
  mock.updateCourseEffortSize(course.id, size.id, {
    label: "Small",
    minMinutes: 90,
    maxMinutes: 120,
  });
  mock.deleteCourseEffortPartKind(course.id, kind.id);
  expect(
    mock.getActivity(activity.activity.id).currentVersion?.effortParts?.[0],
  ).toMatchObject({ label: "Read", partKindId: null });
  expect(
    mock.getActivityVersion(activity.currentVersion.id).detail,
  ).toMatchObject({ effortMinMinutes: 10, effortMaxMinutes: 20 });
});

it("seeds student effort and previews/applies/clears a Term override in the mock", () => {
  const course = mock.listCourses()[0];
  expect(mock.listCourseEffortSizes(course.id)).toHaveLength(3);
  expect(mock.listCourseEffortPartKinds(course.id)).toHaveLength(2);
  const term = mock.listTerms(course.id).find((row) => row.status === "active")!;
  const listed = mock.listTermActivitiesWithRevisions(term.id);
  const activity = listed.termActivities[0];
  const revision = listed.revisionsByTermActivityId[activity.id].planned!;
  expect(revision.effectiveEffort).toEqual({ minMinutes: 60, maxMinutes: 120 });
  for (const low of [30, null]) {
    const detail = revision.detail.behaviorFamily === "meeting" ? null : { ...revision.detail, effortMinMinutes: low, effortMaxMinutes: low === null ? null : 45 };
    if (!detail) throw new Error("Expected coursework demo");
    const request = { title: revision.title, detail, advancePointer: "delivered" as const };
    const preview = mock.previewTermActivityRevision(activity.id, request);
    const applied = mock.applyTermActivityRevision(activity.id, { ...request, previewToken: preview.previewToken, expectedCurrentRevisionId: preview.expectedCurrentRevisionId });
    expect(applied.revision.effectiveEffort).toEqual(low === null ? { minMinutes: 60, maxMinutes: 120 } : { minMinutes: 30, maxMinutes: 45 });
  }
});

it("rejects conflicting totals, removes parts explicitly, and clears parts on a meeting revision", async () => {
  const course = mock.listCourses()[1];
  const input = {
    title: "A",
    activityTypeVersionId: "type",
    detail: {
      behaviorFamily: "coursework" as const,
      submissionPolicy: "Submit",
      releasePolicy: "Release",
      authoringNotes: "Notes",
    },
    effortParts: [
      { sequence: 0, label: "Read", minMinutes: 10, maxMinutes: 20 },
    ],
  };
  const activity = await mock.createCourseActivity(course.id, {
    stableCode: "a",
    version: input,
  });
  const id = activity.activity.id;
  await expect(
    mock.createActivityVersion(id, {
      ...input,
      effortParts: undefined,
      detail: { ...input.detail, effortMinMinutes: 99, effortMaxMinutes: 100 },
    }),
  ).rejects.toThrow("This estimate is built from parts");
  await expect(
    mock.createActivityVersion(id, {
      ...input,
      detail: { ...input.detail, effortMinMinutes: 99, effortMaxMinutes: 100 },
    }),
  ).rejects.toThrow("sum");
  const withoutParts = await mock.createActivityVersion(id, {
    title: "A",
    activityTypeVersionId: "type",
      detail: {
        behaviorFamily: "coursework",
        submissionPolicy: null,
        releasePolicy: null,
        authoringNotes: null,
      },
    effortParts: [],
  });
  expect(withoutParts.effortParts).toEqual([]);
  expect(withoutParts.detail).toMatchObject({
    effortMinMinutes: 10,
    effortMaxMinutes: 20,
  });
  const withParts = await mock.createActivityVersion(id, input);
  expect(withParts.effortParts).toHaveLength(1);
  const meeting = await mock.createActivityVersion(id, {
    title: "Meeting",
    activityTypeVersionId: "meeting",
    detail: {
      behaviorFamily: "meeting",
      defaultDurationMinutes: null,
      preparationNotes: null,
      modality: null,
      authoringNotes: null,
    },
  });
  expect(meeting.effortParts).toEqual([]);
  expect(meeting.detail).not.toHaveProperty("effortMinMinutes");
});

it("keeps the targeted Term override on omission and rejects changed effort after preview", () => {
  const course = mock.listCourses()[0];
  const term = mock.listTerms(course.id).find((row) => row.status === "active")!;
  const listed = mock.listTermActivitiesWithRevisions(term.id);
  const activity = listed.termActivities[0];
  const revision = listed.revisionsByTermActivityId[activity.id].planned!;
  if (revision.detail.behaviorFamily === "meeting")
    throw new Error("Expected coursework");
  const request = {
    title: revision.title,
    detail: { ...revision.detail, effortMinMinutes: 15, effortMaxMinutes: 25 },
    advancePointer: "planned" as const,
  };
  const preview = mock.previewTermActivityRevision(activity.id, request);
  expect(preview.expectedCurrentRevisionId).toBe(activity.plannedRevisionId);
  expect(() =>
    mock.applyTermActivityRevision(activity.id, {
      ...request,
      detail: { ...request.detail, effortMaxMinutes: 30 },
      previewToken: preview.previewToken,
      expectedCurrentRevisionId: preview.expectedCurrentRevisionId,
    }),
  ).toThrow("stale"); mock.applyTermActivityRevision(activity.id, { ...request, previewToken: preview.previewToken, expectedCurrentRevisionId: preview.expectedCurrentRevisionId });
  const detail = {
    ...request.detail,
    effortMinMinutes: undefined,
    effortMaxMinutes: undefined,
  };
  const dateEdit = mock.previewTermActivityRevision(activity.id, {
    ...request,
    detail,
  });
  expect(dateEdit.proposedRevision.detail).toMatchObject({
    effortMinMinutes: 15,
    effortMaxMinutes: 25,
  });
});

it("replaces non-effort relationships on omission and preserves explicitly supplied content", async () => {
  const course = mock.listCourses()[0];
  const topic = mock.listTopics(course.id)[0];
  const learningModule = mock.listLearningModules(course.id)[0];
  const created = await mock.createCourseActivity(course.id, {
    stableCode: "effort-content",
    version: {
      title: "A",
      activityTypeVersionId: "type",
      detail: {
        behaviorFamily: "coursework",
        submissionPolicy: "Submit",
        releasePolicy: "Release",
        authoringNotes: "Notes",
      },
      topicActions: [
        {
          topicVersionId: topic.currentVersionId!,
          action: "practiced",
          notes: "Keep",
        },
      ],
      learningModuleScopes: [
        { learningModuleId: learningModule.id, emphasis: "Review" },
      ],
      milestoneTemplates: [{ sequence: 0, role: "due", label: "Due" }],
    },
  });
  expect(
    mock.listActivityTopicActions(created.currentVersion.id),
  ).toMatchObject([
    { topicVersionId: topic.currentVersionId, action: "practiced" },
  ]);
  expect(mock.listActivityLmScope(created.currentVersion.id)).toMatchObject([
    { learningModuleId: learningModule.id },
  ]);
  const revision = await mock.createActivityVersion(created.activity.id, {
    title: "B",
    activityTypeVersionId: "type",
    detail: { behaviorFamily: "coursework" } as never,
  });
  expect(mock.listActivityTopicActions(revision.id)).toEqual([]);
  expect(mock.listActivityLmScope(revision.id)).toEqual([]);
  expect(revision.milestoneTemplates).toEqual([]);
  expect(revision.detail).toMatchObject({
    submissionPolicy: null,
    releasePolicy: null,
    authoringNotes: null,
  });
});

it("invalidates a delivered preview when its inherited planned effort changes", () => {
  const course = mock.listCourses()[0];
  const term = mock
    .listTerms(course.id)
    .find((row) => row.status === "active")!;
  const listed = mock.listTermActivitiesWithRevisions(term.id);
  const activity = listed.termActivities[0];
  const revision = listed.revisionsByTermActivityId[activity.id].planned!;
  if (revision.detail.behaviorFamily === "meeting")
    throw new Error("Expected coursework");
  const request = {
    title: revision.title,
    detail: {
      ...revision.detail,
      effortMinMinutes: undefined,
      effortMaxMinutes: undefined,
    },
    advancePointer: "delivered" as const,
  };
  const deliveredPreview = mock.previewTermActivityRevision(
    activity.id,
    request,
  );
  const planned = {
    ...request,
    detail: { ...request.detail, effortMinMinutes: 30, effortMaxMinutes: 45 },
    advancePointer: "planned" as const,
  };
  const plannedPreview = mock.previewTermActivityRevision(activity.id, planned);
  mock.applyTermActivityRevision(activity.id, {
    ...planned,
    previewToken: plannedPreview.previewToken,
    expectedCurrentRevisionId: plannedPreview.expectedCurrentRevisionId,
  });
  expect(() =>
    mock.applyTermActivityRevision(activity.id, {
      ...request,
      previewToken: deliveredPreview.previewToken,
      expectedCurrentRevisionId: deliveredPreview.expectedCurrentRevisionId,
    }),
  ).toThrow("stale");
});

it("preserves omitted Term revision lists and honors explicit removal", () => {
  const term = mock.listTerms(mock.listCourses()[0].id).find(row => row.status === "active")!;
  const listed = mock.listTermActivitiesWithRevisions(term.id);
  const activity = listed.termActivities[0];
  const current = listed.revisionsByTermActivityId[activity.id].planned!;
  const request = { title: current.title, detail: current.detail, advancePointer: "planned" as const, topicActions: [{ topicVersionId: "topic", action: "introduced" as const }], milestones: [{ role: "due" as const, label: "Keep", occursAt: "2026-12-01T12:00:00Z", anchorPolicy: "standalone" as const }] };
  const p = mock.previewTermActivityRevision(activity.id, request);
  mock.applyTermActivityRevision(activity.id, { ...request, previewToken: p.previewToken, expectedCurrentRevisionId: p.expectedCurrentRevisionId });
  const omitted = mock.previewTermActivityRevision(activity.id, { title: "Edit", detail: current.detail, advancePointer: "planned" });
  expect(omitted.proposedRevision.topicActions).toMatchObject([{ topicVersionId: "topic" }]);
  expect(omitted.proposedRevision.milestones).toMatchObject([{ label: "Keep" }]);
  const empty = mock.previewTermActivityRevision(activity.id, { title: "Edit", detail: current.detail, advancePointer: "planned", topicActions: [], milestones: [] });
  expect(empty.proposedRevision.topicActions).toEqual([]);
  expect(empty.proposedRevision.milestones).toEqual([]);
});

it("invalidates an omitted-list preview when the inherited planned collections change", () => {
  const term = mock.listTerms(mock.listCourses()[0].id).find(row => row.status === "active")!;
  const listed = mock.listTermActivitiesWithRevisions(term.id);
  const activity = listed.termActivities[0];
  const revision = listed.revisionsByTermActivityId[activity.id].planned!;
  const request = { title: revision.title, detail: revision.detail, advancePointer: "delivered" as const };
  const delivered = mock.previewTermActivityRevision(activity.id, request);
  const planned = { ...request, advancePointer: "planned" as const, topicActions: [{ topicVersionId: "topic", action: "introduced" as const }] };
  const p = mock.previewTermActivityRevision(activity.id, planned);
  mock.applyTermActivityRevision(activity.id, { ...planned, previewToken: p.previewToken, expectedCurrentRevisionId: p.expectedCurrentRevisionId });
  expect(() => mock.applyTermActivityRevision(activity.id, { ...request, previewToken: delivered.previewToken, expectedCurrentRevisionId: delivered.expectedCurrentRevisionId })).toThrow("stale");
});

function termRevisionFixture() {
  const term = mock.listTerms(mock.listCourses()[0].id).find(row => row.status === "active")!;
  const listed = mock.listTermActivitiesWithRevisions(term.id);
  const activity = listed.termActivities[0];
  const revision = listed.revisionsByTermActivityId[activity.id].planned!;
  return { term, listed, activity, revision, request: { title: revision.title, detail: revision.detail, advancePointer: "planned" as const } };
}
it.each([
  { anchorPolicy: "follow_activity", linkedTermActivityId: "self" },
  { anchorPolicy: "follow_activity" },
  { anchorPolicy: "follow_activity", linkedTermActivityId: "missing" },
  { anchorPolicy: "fixed_instant" }, { anchorPolicy: "standalone" },
  { anchorPolicy: "standalone", occursAt: "2026-12-01T12:00Z", sourceTemplateId: "wrong" },
] as const)("mock rejects invalid supplied milestones: %j", fields => {
  const f = termRevisionFixture();
  const milestone = { role: "due" as const, label: "Due", ...fields, linkedTermActivityId: "linkedTermActivityId" in fields && fields.linkedTermActivityId === "self" ? f.activity.id : "linkedTermActivityId" in fields ? fields.linkedTermActivityId : undefined };
  expect(() => mock.previewTermActivityRevision(f.activity.id, { ...f.request, milestones: [milestone] })).toThrow();
});
it("mock rejects a follow target in another Term", async () => {
  const { vi } = await import("vitest");
  const saved: Array<{ id: string; termId: string }> = [];
  const original = Map.prototype.set;
  const spy = vi.spyOn(Map.prototype, "set").mockImplementation(function (this: Map<unknown, unknown>, key, value) {
    if (value?.termId && value.plannedActivityVersionId) saved.push(value);
    return original.call(this, key, value);
  });
  try { mock.resetMockBackend(); } finally { spy.mockRestore(); }
  const f = termRevisionFixture();
  const linked = saved.find(row => row.id !== f.activity.id)!;
  linked.termId = "another-term";
  expect(() => mock.previewTermActivityRevision(f.activity.id, { ...f.request, milestones: [{ role: "due", label: "Due", anchorPolicy: "follow_activity", linkedTermActivityId: linked.id }] })).toThrow("same Term");
});
it("mock preserves delivered lifecycle state on later planned edits", () => {
  const f = termRevisionFixture();
  const delivered = { ...f.request, advancePointer: "delivered" as const, detail: { ...f.revision.detail, lifecycleState: "done" } };
  const d = mock.previewTermActivityRevision(f.activity.id, delivered);
  const applied = mock.applyTermActivityRevision(f.activity.id, { ...delivered, previewToken: d.previewToken, expectedCurrentRevisionId: d.expectedCurrentRevisionId });
  expect(applied.termActivity.lifecycleState).toBe("done");
  const planned = { ...f.request, detail: { ...f.revision.detail, lifecycleState: "planned" } };
  const p = mock.previewTermActivityRevision(f.activity.id, planned);
  expect(mock.applyTermActivityRevision(f.activity.id, { ...planned, previewToken: p.previewToken, expectedCurrentRevisionId: p.expectedCurrentRevisionId }).termActivity.lifecycleState).toBe("done");
});
it("mock uses the highest revision number even when historical numbers have gaps", async () => {
  const { vi } = await import("vitest");
  const saved: Array<{ termActivityId: string; revision: number }> = [];
  const original = Map.prototype.set;
  const spy = vi.spyOn(Map.prototype, "set").mockImplementation(function (this: Map<unknown, unknown>, key, value) {
    if (value?.termActivityId && typeof value.revision === "number") saved.push(value);
    return original.call(this, key, value);
  });
  try { mock.resetMockBackend(); } finally { spy.mockRestore(); }
  const f = termRevisionFixture();
  saved.find(row => row.termActivityId === f.activity.id)!.revision = 7;
  expect(mock.previewTermActivityRevision(f.activity.id, f.request).proposedRevision.revision).toBe(8);
});
it("mock clears stale slot links when changing a meeting start instant", async () => {
  const { vi } = await import("vitest");
  const values: Array<Record<string, unknown>> = [];
  const original = Map.prototype.set;
  const spy = vi.spyOn(Map.prototype, "set").mockImplementation(function (this: Map<unknown, unknown>, key, value) {
    if (value && typeof value === "object") values.push(value);
    return original.call(this, key, value);
  });
  try { mock.resetMockBackend(); } finally { spy.mockRestore(); }
  const f = termRevisionFixture();
  const base = values.find(row => row.id === f.activity.plannedActivityVersionId)!;
  base.detail = { behaviorFamily: "meeting" };
  const source = values.find(row => row.id === f.revision.id)!;
  source.detail = { behaviorFamily: "meeting", calendarSlotId: "old-slot", startsAt: "2026-11-17T14:00Z" };
  const p = mock.previewTermActivityRevision(f.activity.id, { ...f.request, detail: { behaviorFamily: "meeting", calendarSlotId: "old-slot", startsAt: "2030-01-01T14:00Z", endsAt: null, status: "scheduled", modality: null, overrideReason: null, overrideEvidence: null } });
  expect(p.proposedRevision.detail).toMatchObject({ calendarSlotId: null });
});
