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
