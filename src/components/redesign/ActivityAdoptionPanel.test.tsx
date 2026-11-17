// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import ActivityAdoptionPanel from "./ActivityAdoptionPanel";

afterEach(() => setMockBackend(null));

it("shows milestone counts and missing-link reasons before applying the reviewed selection", async () => {
  const preview = { kind: "preview" as const, previewToken: "token", expectedCurrentActivityCount: 0, alreadyAdopted: [],
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

const response = { kind: "preview" as const, previewToken: "token", expectedCurrentActivityCount: 1,
  alreadyAdopted: [{ activityId: "old", adoptedLabel: "Existing practice" }],
  candidates: [{ activityId: "new", activityVersionId: "v", adoptedLabel: "New practice", ordinal: 1,
    termLearningModuleId: null, milestoneCount: 0, standaloneMilestones: [] }],
  impact: { issues: [], topicActionDuplicates: [], calendarConflicts: [] } };

function mount() {
  return render(<ActivityAdoptionPanel termId="term" selections={[]} onAdopted={vi.fn()} />);
}

it("has a labelled card and a live region before preview, and reports skipped Activities with no apply for empty candidates", async () => {
  setMockBackend({ previewTermActivityAdoption: async () => ({ ...response, candidates: [] }) });
  const { container } = mount();
  expect(screen.getByRole("region", { name: "Adopt Activities" })).toBeInTheDocument();
  expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Preview Activity adoption" }));
  expect(await screen.findByText("All selected Activities are already adopted.")).toBeInTheDocument();
  expect(screen.getByText("Already in this Term: Existing practice")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Adopt Activities" })).not.toBeInTheDocument();
});

it("shows preview failures", async () => {
  setMockBackend({ previewTermActivityAdoption: async () => { throw new Error("Preview failed"); } });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Preview Activity adoption" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Preview failed");
});

it.each([500, 409])("handles apply error %s and prevents duplicate applies while busy", async (status) => {
  let reject!: (error: Error) => void;
  const apply = vi.fn(() => new Promise<never>((_resolve, fail) => { reject = fail; }));
  setMockBackend({ previewTermActivityAdoption: async () => response, applyTermActivityAdoption: apply });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Preview Activity adoption" }));
  const button = await screen.findByRole("button", { name: "Adopt Activities" });
  fireEvent.click(button);
  expect(screen.getByRole("button", { name: "Adopting Activities…" })).toBeDisabled();
  fireEvent.click(button);
  expect(apply).toHaveBeenCalledOnce();
  reject(Object.assign(new Error("Apply failed"), { status }));
  expect(await screen.findByRole("alert")).toHaveTextContent(status === 409 ? "The Term changed. Preview again." : "Apply failed");
  if (status === 409) expect(screen.queryByText(/New practice:/)).not.toBeInTheDocument();
  else expect(screen.getByRole("button", { name: "Adopt Activities" })).toBeInTheDocument();
});
