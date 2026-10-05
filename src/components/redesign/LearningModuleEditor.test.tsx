// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type {
  ActivityVersionDto,
  LearningModuleVersionDto,
} from "@/lib/redesign-contract";
import LearningModuleEditor from "./LearningModuleEditor";

const version: LearningModuleVersionDto = {
  id: "lm-v1",
  learningModuleId: "lm-1",
  revision: 1,
  title: "Foundations",
  description: "Instructor description",
  studentDescription: "Student description",
  learningObjectives: ["Explain foundations"],
  notes: "Keep notes",
  defaultSequence: 2,
  changeSummary: null,
  publishedAt: "2026-01-01T00:00:00Z",
  topics: [{ topicVersionId: "topic-v1", sequence: 3 }],
  activities: [
    {
      activityVersionId: "a-old",
      sequence: 0,
      notes: "Preserve placement notes",
    },
  ],
};

function activityVersion(
  id: string,
  activityId: string,
  revision: number,
  title: string,
): ActivityVersionDto {
  return {
    id,
    activityId,
    revision,
    title,
    summary: null,
    activityTypeVersionId: "type-v1",
    changeSummary: null,
    publishedAt: null,
    detail: {
      behaviorFamily: "meeting",
      defaultDurationMinutes: null,
      modality: null,
      preparationNotes: null,
      authoringNotes: null,
    },
    milestoneTemplates: [],
  };
}

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
  setMockBackend({
    listCourseActivities: vi.fn().mockResolvedValue([
      { id: "a", stableCode: "A" },
      { id: "b", stableCode: "B" },
    ]),
    getActivity: vi.fn(async (id: string) => ({
      activity: {
        id,
        courseId: "course-1",
        stableCode: id,
        currentVersionId: `${id}-new`,
        archivedAt: null,
      },
      currentVersion: activityVersion(`${id}-new`, id, 2, `${id} current`),
    })),
    getActivityVersion: vi.fn().mockResolvedValue({
      id: "a-old",
      activityId: "a",
      revision: 1,
      title: "Original activity",
    }),
  });
  const onCancel = vi.fn();
  render(
    <LearningModuleEditor
      courseId="course-1"
      stableCode="LM1"
      version={version}
      onSave={onSave}
      onPublish={vi.fn()}
      onCancel={onCancel}
    />,
  );
  return { onSave, onCancel };
}

afterEach(() => setMockBackend(null));

describe("LearningModuleEditor", () => {
  it("saves a new revision with ordered membership and preserves pinned versions and notes", async () => {
    const { onSave } = setup();
    await screen.findByText(/Original activity/);
    expect(screen.getByText(/Revision 1 · Published/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Module title"), {
      target: { value: "Revised foundations" },
    });
    fireEvent.change(
      screen.getByLabelText("Learning objectives (one per line)"),
      { target: { value: "First\n\nSecond" } },
    );
    fireEvent.change(screen.getByLabelText("Add activity"), {
      target: { value: "b-new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Move b current up" }));
    fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedCurrentVersionId: "lm-v1",
          title: "Revised foundations",
          description: "Instructor description",
          studentDescription: "Student description",
          learningObjectives: ["First", "Second"],
          notes: "Keep notes",
          defaultSequence: 2,
          publish: false,
          topics: [{ topicVersionId: "topic-v1", sequence: 3 }],
          activities: [
            { activityVersionId: "b-new", sequence: 0, notes: null },
            {
              activityVersionId: "a-old",
              sequence: 1,
              notes: "Preserve placement notes",
            },
          ],
        }),
      ),
    );
    expect(version.title).toBe("Foundations");
  });

  it("removes membership locally and cancels without saving", async () => {
    const { onSave, onCancel } = setup();
    await screen.findByText(/Original activity/);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Original activity" }),
    );
    expect(
      screen.getByText("No activities in this module."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("adopts the current Activity version only after removing and adding its membership", async () => {
    const { onSave } = setup();
    await screen.findByText(/Original activity/);
    expect(
      screen.queryByRole("option", { name: "a current · rev. 2" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Original activity" }),
    );
    fireEvent.change(screen.getByLabelText("Add activity"), {
      target: { value: "a-new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedCurrentVersionId: "lm-v1",
          activities: [
            { activityVersionId: "a-new", sequence: 0, notes: null },
          ],
        }),
      ),
    );
    expect(version.activities?.[0]?.activityVersionId).toBe("a-old");
  });

  it("keeps edits on a failed save and disables controls during saving", async () => {
    let rejectSave!: (reason: Error) => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    setup(onSave);
    await screen.findByText(/Original activity/);
    fireEvent.change(screen.getByLabelText("Module title"), {
      target: { value: "Unsaved title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
    expect(screen.getByLabelText("Module title")).toBeDisabled();
    rejectSave(new Error("This module has changed. Reload before saving."));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This module has changed",
    );
    expect(screen.getByLabelText("Module title")).toHaveValue("Unsaved title");
  });

  it("blocks saving if activity membership cannot be loaded", async () => {
    setup();
    setMockBackend({
      listCourseActivities: vi
        .fn()
        .mockRejectedValue(new Error("Activity loading failed")),
    });
    // Remount to exercise a failed initial load.
    const { unmount } = render(
      <LearningModuleEditor
        courseId="broken"
        stableCode="LM2"
        version={version}
        onSave={vi.fn()}
        onPublish={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Activity loading failed",
    );
    expect(
      screen.getAllByRole("button", { name: "Save new version" })[1],
    ).toBeDisabled();
    unmount();
  });
});
