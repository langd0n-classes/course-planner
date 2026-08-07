// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type {
  TermActivityDto,
  TermActivityRevisionDto,
} from "@/lib/redesign-contract";
import ActiveTermDailyDriver from "./ActiveTermDailyDriver";

const activity = (
  id: string,
  ordinal: number | null = null,
): TermActivityDto => ({
  id,
  termId: "term",
  courseId: "course",
  activityId: id,
  plannedActivityVersionId: "version",
  activityTypeVersionId: "type",
  adoptedLabel: "Lecture",
  termLearningModuleId: "module",
  ordinal,
  lifecycleState: null,
  plannedRevisionId: `plan-${id}`,
  deliveredRevisionId: null,
  archivedAt: null,
});
const revision = (
  id: string,
  startsAt = "2026-02-10T14:00:00Z",
): TermActivityRevisionDto => ({
  id: `plan-${id}`,
  termActivityId: id,
  revision: 1,
  baseActivityVersionId: "version",
  title: "Probability workshop",
  summary: "Prepare the sampling demo.",
  changeReason: null,
  createdByInstructorId: null,
  createdAt: "2026-02-01T00:00:00Z",
  detail: {
    behaviorFamily: "meeting",
    calendarSlotId: "slot",
    startsAt,
    endsAt: "2026-02-10T15:00:00Z",
    status: "scheduled",
    modality: null,
    overrideReason: null,
    overrideEvidence: null,
  },
  topicActions: [
    {
      id: "action",
      termActivityRevisionId: `plan-${id}`,
      topicVersionId: "topic",
      action: "introduced",
      notes: null,
      provenance: null,
    },
  ],
  milestones: [
    {
      id: "milestone",
      termActivityRevisionId: `plan-${id}`,
      sourceTemplateId: null,
      role: "due",
      label: "Problem set due",
      linkedTermActivityId: id,
      occursAt: "2026-02-11T23:00:00Z",
      timeZone: "UTC",
      anchorPolicy: "fixed_instant",
      notes: null,
      provenance: null,
    },
  ],
});

function renderDriver(
  options: { editable?: boolean; empty?: boolean; changed?: boolean } = {},
) {
  const meeting = activity("meeting", null);
  const planned = revision("meeting");
  const delivered = options.changed
    ? { ...planned, id: "delivered", revision: 2 }
    : null;
  return render(
    <ActiveTermDailyDriver
      termActivities={options.empty ? [] : [meeting]}
      revisionsByTermActivityId={
        options.empty ? {} : { meeting: { planned, delivered } }
      }
      today="2026-02-09"
      learningModuleLabels={new Map([["module", "Probability"]])}
      topicLabels={new Map([["topic", "Random variables"]])}
      editable={options.editable ?? true}
      onApplied={vi.fn(async () => undefined)}
    />,
  );
}

afterEach(() => {
  setMockBackend(null);
  vi.clearAllMocks();
});

describe("ActiveTermDailyDriver", () => {
  it("renders the next meeting, milestone, module, Topic, and empty states", () => {
    renderDriver();
    expect(screen.getByText("Probability workshop")).toBeInTheDocument();
    expect(screen.getByText(/meeting 1 of 1/)).toBeInTheDocument();
    expect(screen.getByText("Prepare the sampling demo.")).toBeInTheDocument();
    expect(screen.getByText("Problem set due")).toBeInTheDocument();
    expect(screen.getByText("Probability")).toBeInTheDocument();
    expect(screen.getAllByText("Random variables")).toHaveLength(2);
    renderDriver({ empty: true });
    expect(
      screen.getByText("No future meeting is scheduled."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No upcoming milestone is anchored."),
    ).toBeInTheDocument();
  });

  it("previews, applies, announces, and reloads a cancellation correction", async () => {
    const previewTermActivityRevision = vi.fn(async () => ({
      kind: "preview" as const,
      previewToken: "preview-token",
      expectedCurrentRevisionId: "plan-meeting",
      proposedRevision: revision("meeting"),
      impact: {
        issues: [
          {
            code: "topic_flow",
            severity: "warning" as const,
            message: "Topic flow breaks.",
          },
        ],
        topicActionDuplicates: [],
        calendarConflicts: [],
      },
    }));
    const applyTermActivityRevision = vi.fn(async () => ({
      kind: "applied" as const,
      termActivity: activity("meeting"),
      revision: revision("meeting"),
    }));
    const onApplied = vi.fn(async () => undefined);
    setMockBackend({ previewTermActivityRevision, applyTermActivityRevision });
    const meeting = activity("meeting");
    render(
      <ActiveTermDailyDriver
        termActivities={[meeting]}
        revisionsByTermActivityId={{
          meeting: { planned: revision("meeting"), delivered: null },
        }}
        today="2026-02-09"
        learningModuleLabels={new Map()}
        topicLabels={new Map()}
        editable
        onApplied={onApplied}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Preview cancellation" }),
    );
    expect(await screen.findByText("Topic flow breaks.")).toBeInTheDocument();
    expect(previewTermActivityRevision).toHaveBeenCalledWith(
      "meeting",
      expect.objectContaining({ changeReason: "Canceled during delivery." }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply correction" }));
    await waitFor(() =>
      expect(applyTermActivityRevision).toHaveBeenCalledWith(
        "meeting",
        expect.objectContaining({
          previewToken: "preview-token",
          expectedCurrentRevisionId: "plan-meeting",
          advancePointer: "delivered",
        }),
      ),
    );
    expect(onApplied).toHaveBeenCalled();
    expect(screen.getByText(/Delivery correction applied/)).toBeInTheDocument();
  });

  it("shows preview and apply failures, read-only gating, and singular delivery delta", async () => {
    const previewTermActivityRevision = vi.fn(async () => {
      throw new Error("Preview failed");
    });
    setMockBackend({ previewTermActivityRevision });
    renderDriver({ changed: true, editable: false });
    expect(screen.getByText("Read-only Term")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Preview cancellation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/One activity has changed from plan/),
    ).toBeInTheDocument();
  });

  it("keeps the correction panel available when apply fails", async () => {
    const previewTermActivityRevision = vi.fn(async () => ({
      kind: "preview" as const,
      previewToken: "token",
      expectedCurrentRevisionId: "plan-meeting",
      proposedRevision: revision("meeting"),
      impact: { issues: [], topicActionDuplicates: [], calendarConflicts: [] },
    }));
    const applyTermActivityRevision = vi.fn(async () => {
      throw new Error("Apply failed");
    });
    setMockBackend({ previewTermActivityRevision, applyTermActivityRevision });
    renderDriver();
    fireEvent.click(
      screen.getByRole("button", { name: "Preview cancellation" }),
    );
    await screen.findByRole("button", { name: "Apply correction" });
    fireEvent.click(screen.getByRole("button", { name: "Apply correction" }));
    expect(await screen.findByText("Apply failed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply correction" }),
    ).toBeInTheDocument();
  });

  it("surfaces preview failures without opening a correction panel", async () => {
    setMockBackend({
      previewTermActivityRevision: vi.fn(async () => {
        throw new Error("Preview failed");
      }),
    });
    renderDriver();
    fireEvent.click(
      screen.getByRole("button", { name: "Preview cancellation" }),
    );
    expect(await screen.findByText("Preview failed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply correction" }),
    ).not.toBeInTheDocument();
  });

  it("blocks a moved meeting when its end is not after its start", async () => {
    const previewTermActivityRevision = vi.fn();
    setMockBackend({ previewTermActivityRevision });
    renderDriver();
    fireEvent.change(screen.getByLabelText("Move meeting start"), {
      target: { value: "2026-02-10T16:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview move" }));
    expect(
      await screen.findByText("The moved meeting must end after it starts."),
    ).toBeInTheDocument();
    expect(previewTermActivityRevision).not.toHaveBeenCalled();
  });
});
