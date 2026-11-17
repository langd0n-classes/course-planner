// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { redesignApi, setMockBackend } from "@/lib/redesign-api-client";
import { createCourseworkActivityVersion } from "@/lib/redesign-fixtures";
import CourseEffortSettings from "./CourseEffortSettings";
import ActivityEffortEditor from "./ActivityEffortEditor";
import TermEffortEditor from "./TermEffortEditor";
import EffortSummary from "./EffortSummary";
const size = {
  id: "s",
  courseId: "c",
  scale: "student" as const,
  label: "Small",
  minMinutes: 30,
  maxMinutes: 45,
  sequence: 0,
  createdAt: "",
  updatedAt: "",
};
afterEach(() => {
  cleanup();
  setMockBackend(null);
});
function mockVocabulary() {
  setMockBackend({
    listCourseEffortSizes: async () => [size],
    listCourseEffortPartKinds: async () => [],
  });
}
describe("effort controls", () => {
  it("shows Not sized and exact size matches", () => {
    const { rerender } = render(<EffortSummary range={null} sizes={[size]} />);
    expect(screen.getByText("Not sized")).toBeTruthy();
    rerender(<EffortSummary range={size} sizes={[size]} />);
    expect(screen.getByText("Small · 30 to 45 min")).toBeTruthy();
  });
  it("defines a Course size using hours and minutes", async () => {
    const create = vi.fn(async () => size);
    setMockBackend({
      listCourseEffortSizes: async () => [],
      listCourseEffortPartKinds: async () => [],
      createCourseEffortSize: create,
    });
    render(<CourseEffortSettings courseId="c" />);
    fireEvent.change(await screen.findByLabelText("New size label"), {
      target: { value: "Small" },
    });
    fireEvent.change(screen.getByLabelText("New size low minutes"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("New size high minutes"), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add size" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("c", {
        label: "Small",
        minMinutes: 30,
        maxMinutes: 45,
      }),
    );
  });
  it("selects a size, types a range and adds a labeled part", async () => {
    mockVocabulary();
    const save = vi
      .spyOn(redesignApi, "createActivityVersion")
      .mockResolvedValue(createCourseworkActivityVersion());
    render(
      <ActivityEffortEditor
        courseId="c"
        version={createCourseworkActivityVersion()}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Course size"), {
      target: { value: "s" },
    });
    expect(
      (screen.getByLabelText("Estimate low minutes") as HTMLInputElement).value,
    ).toBe("30");
    fireEvent.change(screen.getByLabelText("Estimate high hours"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save effort draft" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          detail: expect.objectContaining({
            effortMinMinutes: 30,
            effortMaxMinutes: 105,
          }),
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add part" }));
    fireEvent.change(screen.getByLabelText("Part 1 label"), {
      target: { value: "Read" },
    });
    fireEvent.change(screen.getByLabelText("Part 1 low minutes"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Part 1 high minutes"), {
      target: { value: "20" },
    });
    expect(screen.getByText("Total: 10 to 20 min")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save effort draft" }));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          effortParts: [
            expect.objectContaining({
              label: "Read",
              minMinutes: 10,
              maxMinutes: 20,
            }),
          ],
        }),
      ),
    );
    save.mockRestore();
  });
  it("ties an invalid range error to its inputs and prevents save", async () => {
    mockVocabulary();
    const save = vi.spyOn(redesignApi, "createActivityVersion");
    render(
      <ActivityEffortEditor
        courseId="c"
        version={createCourseworkActivityVersion()}
        onSaved={vi.fn()}
      />,
    );
    await screen.findByLabelText("Course size");
    fireEvent.change(screen.getByLabelText("Estimate low minutes"), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByLabelText("Estimate high minutes"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save effort draft" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen
        .getByLabelText("Estimate high minutes")
        .getAttribute("aria-describedby"),
    ).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    save.mockRestore();
  });
  it("previews and applies a Term override, then clears it", async () => {
    const version = createCourseworkActivityVersion();
    const revision = {
      id: "r",
      termActivityId: "ta",
      revision: 1,
      baseActivityVersionId: version.id,
      title: "Project",
      summary: null,
      changeReason: null,
      createdByInstructorId: null,
      createdAt: "",
      detail: {
        behaviorFamily: "coursework" as const,
        lifecycleState: null,
        deliveryNotes: null,
        effortMinMinutes: 30,
        effortMaxMinutes: 45,
      },
      topicActions: [],
      milestones: [],
      baseEffort: { effortMinMinutes: 60, effortMaxMinutes: 90 },
    };
    const preview = vi.fn(async () => ({
      kind: "preview" as const,
      previewToken: "token",
      expectedCurrentRevisionId: null,
      proposedRevision: revision,
      impact: { issues: [], topicActionDuplicates: [], calendarConflicts: [] },
    }));
    const apply = vi.fn(async () => ({
      kind: "applied" as const,
      revision,
      termActivity: {} as never,
    }));
    setMockBackend({
      previewTermActivityRevision: preview,
      applyTermActivityRevision: apply,
    });
    render(
      <TermEffortEditor
        revision={revision}
        editable
        advancePointer="delivered"
        onApplied={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Activity version: 1 h to 1 h 30 min/),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Preview effort override" }),
    );
    await screen.findByRole("button", { name: "Apply effort override" });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply effort override" }),
    );
    await waitFor(() => expect(apply).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText("Override student effort"));
    fireEvent.click(
      screen.getByRole("button", { name: "Preview effort override" }),
    );
    await waitFor(() =>
      expect(preview).toHaveBeenLastCalledWith(
        "ta",
        expect.objectContaining({
          detail: expect.objectContaining({
            effortMinMinutes: null,
            effortMaxMinutes: null,
          }),
        }),
      ),
    );
  });
});

it("focuses added and remaining parts, preserves typed labels and shows one linked parts error", async () => {
  setMockBackend({
    listCourseEffortSizes: async () => [],
    listCourseEffortPartKinds: async () => [
      { id: "k", courseId: "c", label: "Read", sequence: 0, createdAt: "" },
    ],
  });
    render(
      <ActivityEffortEditor
        courseId="c"
        version={createCourseworkActivityVersion()}
        onSaved={vi.fn()}
      />,
    );
  await waitFor(() =>
    expect(screen.getByLabelText("Course size")).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add part" }));
  expect(screen.getByLabelText("Part 1 kind")).toHaveFocus();
  fireEvent.change(screen.getByLabelText("Part 1 label"), {
    target: { value: "My label" },
  });
  fireEvent.change(screen.getByLabelText("Part 1 kind"), {
    target: { value: "k" },
  });
  expect(screen.getByLabelText("Part 1 label")).toHaveValue("My label");
  fireEvent.click(screen.getByRole("button", { name: "Add part" }));
  expect(screen.getByLabelText("Part 2 kind")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Save effort draft" }));
  expect(await screen.findAllByRole("alert")).toHaveLength(1);
  expect(screen.getByLabelText("Part 1 low hours")).toHaveAttribute(
    "aria-describedby",
  );
  expect(screen.getByLabelText("Part 2 label")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove part 1" }));
  expect(screen.getByLabelText("Part 1 kind")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Remove part 1" }));
  expect(screen.getByRole("button", { name: "Add part" })).toHaveFocus();
});

it("sends the complete version content with changed effort", async () => {
  mockVocabulary();
  const version = createCourseworkActivityVersion();
  const actions = [
    {
      topicVersionId: "tv",
      action: "practiced" as const,
      notes: "Keep",
      provenance: { source: "manual" },
    },
  ];
  const scopes = [
    { learningModuleId: "lm", emphasis: "Review", notes: "Keep" },
  ];
  const save = vi
    .spyOn(redesignApi, "createActivityVersion")
    .mockResolvedValue(version);
  render(
    <ActivityEffortEditor
      courseId="c"
      version={version}
      topicActions={actions}
      learningModuleScopes={scopes}
      onSaved={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save effort draft" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      version.activityId,
      expect.objectContaining({
        detail: expect.objectContaining(version.detail),
        topicActions: actions,
        learningModuleScopes: scopes,
        milestoneTemplates: version.milestoneTemplates,
      }),
    ),
  );
  expect(
    screen.getByText(/unpublished save creates a draft version/i),
  ).toBeTruthy();
  save.mockRestore();
});

it("confirms deletes, keeps row identity and restores focus with one announcement region", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const remove = vi.fn(async () => {});
  const update = vi.fn(async (_course, _id, input) => ({
    ...size,
    ...input,
    updatedAt: "new",
  }));
  let rows = [size];
  setMockBackend({
    listCourseEffortSizes: async () => rows,
    listCourseEffortPartKinds: async () => [
      { id: "k", courseId: "c", label: "Read", sequence: 0, createdAt: "" },
    ],
    deleteCourseEffortSize: remove,
    deleteCourseEffortPartKind: remove,
    updateCourseEffortSize: update,
  });
  render(<CourseEffortSettings courseId="c" />);
  const label = await screen.findByLabelText("Small label");
  fireEvent.click(screen.getByRole("button", { name: "Delete Small" }));
  expect(confirm).toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete Read" }));
  expect(confirm).toHaveBeenLastCalledWith(
    expect.stringMatching(/keeps.*label/i),
  );
  rows = [{ ...size, updatedAt: "new" }];
  fireEvent.click(screen.getByRole("button", { name: "Save Small" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Small label")).toHaveFocus(),
  );
  expect(screen.getByLabelText("Small label")).toBe(label);
  confirm.mockReturnValue(true);
  rows = [];
  fireEvent.click(screen.getByRole("button", { name: "Delete Small" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add size" })).toHaveFocus(),
  );
  expect(screen.getAllByRole("status")).toHaveLength(1);
  confirm.mockRestore();
});

it("prefills a new Term override from the Activity and mounts its preview live region early", () => {
  const revision = {
    id: "r",
    termActivityId: "ta",
    revision: 1,
    baseActivityVersionId: "v",
    title: "A",
    summary: null,
    changeReason: null,
    createdByInstructorId: null,
    createdAt: "",
    detail: {
      behaviorFamily: "coursework" as const,
      lifecycleState: null,
      deliveryNotes: null,
      effortMinMinutes: null,
      effortMaxMinutes: null,
    },
    topicActions: [],
    milestones: [],
    baseEffort: { effortMinMinutes: 60, effortMaxMinutes: 90 },
  };
  render(
    <TermEffortEditor
      revision={revision}
      editable
      advancePointer="planned"
      onApplied={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("Effort preview")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  fireEvent.click(screen.getByLabelText("Override student effort"));
  expect(screen.getByLabelText("Term override low hours")).toHaveValue(1);
  expect(screen.getByLabelText("Term override high minutes")).toHaveValue(30);
});

it("moves focus with a reordered row and announces errors in the same live region", async () => {
  const second = { ...size, id: "s2", label: "Large", sequence: 1 };
  let rows = [size, second];
  const reorder = vi.fn(async (_course, ids: string[]) => {
    rows = ids.map((id) => rows.find((row) => row.id === id)!);
    return rows;
  });
  setMockBackend({
    listCourseEffortSizes: async () => rows,
    listCourseEffortPartKinds: async () => [],
    reorderCourseEffortSizes: reorder,
  });
  render(<CourseEffortSettings courseId="c" />);
  const move = await screen.findByRole("button", { name: "Move down Small" });
  expect(move.getAttribute("aria-label")).toMatch(/^Move down/);
  fireEvent.click(move);
  await waitFor(() =>
    expect(screen.getByLabelText("Small label")).toHaveFocus(),
  );
  expect(reorder).toHaveBeenCalledWith("c", ["s2", "s"]);
  fireEvent.change(screen.getByLabelText("Small label"), {
    target: { value: " " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Small" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Enter a label."),
  );
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.queryByRole("alert")).toBeNull();
});
