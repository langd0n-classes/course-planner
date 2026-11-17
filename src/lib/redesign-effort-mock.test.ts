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
