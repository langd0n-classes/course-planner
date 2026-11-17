import { expect, it } from "vitest";
import { toTermAdoptionPreviewDto } from "./redesign-serializers";

it("serializes milestone counts and unresolved links without leaking service-only fields", () => {
  const candidate = { activityId: "a", activityVersionId: "v", adoptedLabel: "Practice", ordinal: 1,
    termLearningModuleId: "lm", milestoneCount: 2,
    standaloneMilestones: [{ sourceTemplateId: "t", label: "Due", reason: "Linked Activity is not adopted in this Term" }], internal: true };
  const preview = { kind: "preview" as const, previewToken: "token", expectedCurrentActivityCount: 0,
    candidates: [candidate], impact: { issues: [], topicActionDuplicates: [], calendarConflicts: [] } };
  const dto = toTermAdoptionPreviewDto(preview);
  expect(dto.candidates[0]).toMatchObject({ milestoneCount: 2, standaloneMilestones: candidate.standaloneMilestones });
  expect(dto.candidates[0]).not.toHaveProperty("internal");
});
