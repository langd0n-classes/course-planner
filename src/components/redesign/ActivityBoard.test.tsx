// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type { ActivityVersionLearningModuleScopeDto } from "@/lib/redesign-contract";
import ActivityBoard from "./ActivityBoard";

const activity = { id: "a-1", courseId: "course-1", stableCode: "W1", currentVersionId: "av-1", archivedAt: null };
const version = { id: "av-1", activityId: "a-1", revision: 1, title: "Probability workshop", summary: null, activityTypeVersionId: "type-1", changeSummary: null, publishedAt: null, detail: { behaviorFamily: "meeting" as const, defaultDurationMinutes: null, modality: null, preparationNotes: null, authoringNotes: null }, milestoneTemplates: [] };
function renderBoard(onMove = vi.fn(async () => {}), initialScopes: ActivityVersionLearningModuleScopeDto[] = [], replaceActivityLmScope: (id: string, scopes: Array<{ learningModuleId: string; emphasis?: string | null; notes?: string | null }>) => Promise<ActivityVersionLearningModuleScopeDto[]> = async (_id, scopes) => scopes.map((scope, index) => ({ id: `scope-${index}`, activityVersionId: "av-1", learningModuleId: scope.learningModuleId, emphasis: scope.emphasis ?? null, notes: scope.notes ?? null })) ) {
  setMockBackend({ listCourseActivities: vi.fn(async () => [activity]), getActivity: vi.fn(async () => ({ activity, currentVersion: version })), listActivityTopicActions: vi.fn(async () => [{ id: "ta-1", activityVersionId: "av-1", topicVersionId: "tv-1", action: "introduced" as const, notes: null, provenance: null, siblings: [{ activityVersionId: "av-2", activityId: "a-2", activityStableCode: "W2", action: "introduced" as const }] }]), listActivityLmScope: vi.fn(async () => initialScopes), replaceActivityLmScope, replaceActivityTopicActions: vi.fn(async () => []) });
  render(<ActivityBoard courseId="course-1" learningModules={[{ id: "lm-1", courseId: "course-1", stableCode: "PROB", currentVersionId: "lmv-1", archivedAt: null }]} currentVersionsByLearningModuleId={new Map([["lm-1", { id: "lmv-1", learningModuleId: "lm-1", revision: 1, title: "Probability", description: null, studentDescription: null, learningObjectives: [], notes: null, defaultSequence: 1, changeSummary: null, publishedAt: null, topics: [] }]])} topics={[{ id: "topic-1", courseId: "course-1", learningModuleId: null, stableCode: "P1", currentVersionId: "tv-1", archivedAt: null }]} currentVersionsByTopicId={new Map([["topic-1", { id: "tv-1", topicId: "topic-1", revision: 1, title: "Random variables", category: null, description: null, changeSummary: null, publishedAt: null }]])} onMove={onMove} />);
  return onMove;
}

describe("ActivityBoard", () => {
  it("uses the shared move action for keyboard move controls", async () => {
    const onMove = renderBoard();
    const control = await screen.findByLabelText("Move Probability workshop to");
    fireEvent.change(control, { target: { value: "lm-1" } });
    await waitFor(() => expect(onMove).toHaveBeenCalledWith("av-1", "lm-1"));
    expect(screen.getByText("Moved activity to Probability.")).toBeInTheDocument();
  });

  it("uses the same move action for pointer drop and exposes topic-action duplicate navigation", async () => {
    const onMove = renderBoard();
    const card = await screen.findByText("Probability workshop");
    fireEvent.dragStart(card.closest("article")!);
    fireEvent.drop(screen.getAllByText("Probability").find((element) => element.tagName === "P")!.parentElement!);
    await waitFor(() => expect(onMove).toHaveBeenCalledWith("av-1", "lm-1"));
    fireEvent.click(screen.getByRole("button", { name: /Probability workshop/ }));
    expect(await screen.findByText("Also introduced: W2")).toBeInTheDocument();
    expect(screen.getByText("Probability workshop (I)")).toBeInTheDocument();
  });

  it("renders current scopes with learning-module titles", async () => {
    renderBoard(vi.fn(async () => {}), [{ id: "scope-1", activityVersionId: "av-1", learningModuleId: "lm-1", emphasis: "Review", notes: "Connect ideas" }]);
    fireEvent.click(await screen.findByRole("button", { name: /Probability workshop/ }));
    expect(await screen.findByText("Learning-module scope")).toBeInTheDocument();
    expect(screen.getAllByText("Probability").length).toBeGreaterThan(0);
    expect(screen.getByText("Emphasis: Review")).toBeInTheDocument();
    expect(screen.getByText("Notes: Connect ideas")).toBeInTheDocument();
  });

  it("adds a scope with the full list and joins Cross-cutting", async () => {
    const replace = vi.fn(async (_id: string, scopes: Array<{ learningModuleId: string; emphasis?: string | null; notes?: string | null }>) => scopes.map((scope, index) => ({ id: `saved-${index}`, activityVersionId: "av-1", ...scope })));
    renderBoard(vi.fn(async () => {}), [], replace as (id: string, scopes: Array<{ learningModuleId: string; emphasis?: string | null; notes?: string | null }>) => Promise<ActivityVersionLearningModuleScopeDto[]>);
    fireEvent.click(await screen.findByRole("button", { name: /Probability workshop/ }));
    fireEvent.change(screen.getByLabelText("Add learning-module scope"), { target: { value: "lm-1" } });
    fireEvent.change(screen.getByLabelText("Scope emphasis"), { target: { value: "Practice" } });
    fireEvent.change(screen.getByLabelText("Scope notes"), { target: { value: "Use examples" } });
    fireEvent.click(screen.getByRole("button", { name: "Add scope" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("av-1", [{ learningModuleId: "lm-1", emphasis: "Practice", notes: "Use examples" }]));
    expect(screen.getAllByText("Cross-cutting").length).toBeGreaterThan(0);
  });

  it("removes the last scope and leaves Cross-cutting", async () => {
    const replace = vi.fn(async () => []);
    renderBoard(vi.fn(async () => {}), [{ id: "scope-1", activityVersionId: "av-1", learningModuleId: "lm-1", emphasis: null, notes: null }], replace as (id: string, scopes: Array<{ learningModuleId: string; emphasis?: string | null; notes?: string | null }>) => Promise<ActivityVersionLearningModuleScopeDto[]>);
    fireEvent.click(await screen.findByRole("button", { name: /Probability workshop/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Probability learning-module scope" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("av-1", []));
    expect(screen.getByText("No learning-module scopes yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Unassigned")[0]!.parentElement?.parentElement).toContainElement(screen.getAllByText("Probability workshop")[0]);
  });

  it("announces a failed save without changing displayed scopes", async () => {
    const replace = vi.fn(async () => { throw new Error("Scope save failed"); });
    renderBoard(vi.fn(async () => {}), [{ id: "scope-1", activityVersionId: "av-1", learningModuleId: "lm-1", emphasis: "Keep", notes: null }], replace as (id: string, scopes: Array<{ learningModuleId: string; emphasis?: string | null; notes?: string | null }>) => Promise<ActivityVersionLearningModuleScopeDto[]>);
    fireEvent.click(await screen.findByRole("button", { name: /Probability workshop/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Probability learning-module scope" }));
    expect(await screen.findByText("Emphasis: Keep")).toBeInTheDocument();
    expect(screen.getByText("Scope save failed")).toBeInTheDocument();
  });
});
