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
