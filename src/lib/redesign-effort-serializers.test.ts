import { expect, it } from "vitest";
import { toActivityVersionDto, toTermActivityRevisionDto } from "./redesign-serializers";
it("returns ordered snapshot parts and only the base effort fields with the effective Term estimate", () => {
  const base = { effortMinMinutes: 60, effortMaxMinutes: 90, submissionPolicy: "Keep private authoring context separate" };
  const activity = { id: "v", activityId: "a", revision: 1, title: "A", summary: null, activityTypeVersionId: "type", publishedAt: null, changeSummary: null, courseworkDetail: { ...base, releasePolicy: null, authoringNotes: null }, effortParts: [{ sequence: 1, label: "Practice", minMinutes: 45, maxMinutes: 60 }, { sequence: 0, label: "Read", minMinutes: 15, maxMinutes: 30 }] };
  expect(toActivityVersionDto(activity).effortParts?.map((part) => part.label)).toEqual(["Read", "Practice"]);
  const revision = { id: "r", termActivityId: "ta", baseActivityVersionId: "v", revision: 1, title: "A", summary: null, changeReason: null, createdByInstructorId: null, createdAt: new Date(), baseActivityVersion: { courseworkDetail: base }, courseworkDetail: { lifecycleState: null, deliveryNotes: null, effortMinMinutes: null, effortMaxMinutes: null } };
  expect(toTermActivityRevisionDto(revision)).toMatchObject({ baseEffort: { effortMinMinutes: 60, effortMaxMinutes: 90 }, effectiveEffort: { minMinutes: 60, maxMinutes: 90 } });
  expect(toTermActivityRevisionDto(revision).baseEffort).not.toHaveProperty("submissionPolicy");
  expect(toTermActivityRevisionDto({ ...revision, courseworkDetail: { ...revision.courseworkDetail, effortMinMinutes: 30, effortMaxMinutes: 45 } }).effectiveEffort).toEqual({ minMinutes: 30, maxMinutes: 45 });
});
