// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import ActivityAdoptionPanel from "./ActivityAdoptionPanel";

afterEach(() => setMockBackend(null));

it("shows milestone counts and missing-link reasons before applying the reviewed selection", async () => {
  const preview = { kind: "preview" as const, previewToken: "token", expectedCurrentActivityCount: 0,
    candidates: [{ activityId: "work", activityVersionId: "work-v1", adoptedLabel: "Practice", ordinal: 1,
      termLearningModuleId: "offering", milestoneCount: 2,
      standaloneMilestones: [{ sourceTemplateId: "due", label: "Practice due", reason: "Linked Activity is not adopted in this Term" }] }],
    impact: { issues: [], topicActionDuplicates: [], calendarConflicts: [] } };
  const apply = vi.fn(async () => ({ kind: "applied" as const, termActivities: [] }));
  const onAdopted = vi.fn();
  setMockBackend({ previewTermActivityAdoption: vi.fn(async () => preview), applyTermActivityAdoption: apply });
  render(<ActivityAdoptionPanel termId="term" selections={[{ termLearningModuleId: "offering", learningModuleVersionId: "module-v1" }]} onAdopted={onAdopted} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview Activity adoption" }));
  expect(await screen.findByText(/2 milestones/)).toBeInTheDocument();
  expect(screen.getByText(/Practice due.*Linked Activity is not adopted/)).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Adopt Activities" }));
  await waitFor(() => expect(onAdopted).toHaveBeenCalledOnce());
  expect(apply).toHaveBeenCalledWith("term", { learningModuleVersionSelections: [{ termLearningModuleId: "offering", learningModuleVersionId: "module-v1" }], crossCuttingSelections: [], previewToken: "token", expectedCurrentActivityCount: 0 });
});
