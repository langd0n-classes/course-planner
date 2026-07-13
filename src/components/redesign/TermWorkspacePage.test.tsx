// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type {
  CalendarSlotDto,
  CourseDto,
  LearningModuleDto,
  LearningModuleVersionDto,
  SessionDto,
  TermDto,
  TermLearningModuleDto,
} from "@/lib/redesign-contract";
import TermWorkspacePage from "./TermWorkspacePage";

function buildTermWorkspaceBackend() {
  const course: CourseDto = {
    id: "course-1",
    instructorId: "instructor-1",
    shortId: "CP-101",
    title: "Course Planning Studio",
    titleIsPlaceholder: false,
    number: "EDUC 210",
    numberIsPlaceholder: false,
    description: "A redesign term-workspace test fixture.",
    archivedAt: null,
  };

  let term: TermDto = {
    id: "term-1",
    courseId: course.id,
    institutionId: "institution-1",
    academicCalendarId: "calendar-1",
    code: "SP26",
    name: "Spring 2026",
    startDate: "2026-02-01",
    endDate: "2026-05-15",
    meetingPattern: null,
    status: "planned",
    closedAt: null,
    clonedFromId: null,
    archivedAt: null,
  };

  const learningModule: LearningModuleDto = {
    id: "learning-module-1",
    courseId: course.id,
    stableCode: "probability-foundations",
    currentVersionId: "learning-module-version-1",
    archivedAt: null,
  };
  const learningModuleVersion: LearningModuleVersionDto = {
    id: "learning-module-version-1",
    learningModuleId: learningModule.id,
    revision: 1,
    title: "Probability Foundations",
    description: null,
    studentDescription: null,
    learningObjectives: ["Understand distributions"],
    notes: null,
    defaultSequence: 1,
    changeSummary: null,
    publishedAt: null,
    topics: [],
  };

  const calendarSlots: CalendarSlotDto[] = Array.from({ length: 18 }, (_, index) => ({
    id: `slot-${index + 1}`,
    termId: term.id,
    academicCalendarEventId: null,
    date: `2026-02-${String(index + 1).padStart(2, "0")}`,
    slotType: "class_day",
    label: null,
    source: "meeting_roles:lecture",
    instructionalCapacity:
      index === 7
        ? "reduced_engagement"
        : index === 8
          ? "recovery"
          : index === 10
            ? "assessment_period"
          : "normal",
    capacitySource:
      index === 7
        ? "heuristic"
        : index === 8
          ? "instructor_override"
          : index === 10
            ? "instructor_override"
          : "baseline",
    capacityReason:
      index === 7
        ? "Reduced capacity before a long weekend."
        : index === 8
          ? "Recovery class after the long weekend."
          : index === 10
            ? "Assessment period session with tightened instructional load."
          : "No explicit break-proximity signal in the calendar.",
  }));

  let termLearningModules: TermLearningModuleDto[] = [];

  const transitionTerm = vi.fn(async (_termId: string, transition: "activate" | "close" | "reopen") => {
    term = {
      ...term,
      status:
        transition === "activate"
          ? "active"
          : transition === "close"
            ? "closed"
            : "active",
      closedAt: transition === "close" ? "2026-02-09T15:00:00.000Z" : null,
    };
    return term;
  });

  const adoptTermLearningModule = vi.fn(
    async (
      _termId: string,
      input: { learningModuleId: string; learningModuleVersionId: string; sequence: number; notes?: string | null },
    ) => {
      const adopted: TermLearningModuleDto = {
        id: `term-learning-module-${termLearningModules.length + 1}`,
        termId: term.id,
        courseId: course.id,
        learningModuleId: input.learningModuleId,
        learningModuleVersionId: input.learningModuleVersionId,
        deliveredLearningModuleVersionId: null,
        sequence: input.sequence,
        notes: input.notes ?? null,
      };
      termLearningModules = [...termLearningModules, adopted];
      return adopted;
    },
  );

  const backend = {
    getTerm: vi.fn(async () => term),
    getCourse: vi.fn(async () => course),
    listLearningModules: vi.fn(async () => [learningModule]),
    getLearningModule: vi.fn(async () => ({ learningModule, currentVersion: learningModuleVersion })),
    listLearningModuleVersions: vi.fn(async () => [learningModuleVersion]),
    listTermLearningModules: vi.fn(async () => [...termLearningModules]),
    getTermLearningModule: vi.fn(async (termLearningModuleId: string) => {
      const termLearningModule = termLearningModules.find((candidate) => candidate.id === termLearningModuleId);
      if (!termLearningModule) throw new Error(`Unknown adopted learning module ${termLearningModuleId}`);
      return termLearningModule;
    }),
    adoptTermLearningModule,
    getPlannedDeliveredDiff: vi.fn(async (termLearningModuleId: string) => ({
      termLearningModuleId,
      plannedLearningModuleVersionId: learningModuleVersion.id,
      deliveredLearningModuleVersionId: null,
      topicChanges: [],
    })),
    listTermSessions: vi.fn(async (): Promise<SessionDto[]> => [
      {
        id: "session-9",
        termId: term.id,
        termLearningModuleId: termLearningModules[0]?.id ?? null,
        calendarSlotId: "slot-9",
        sequence: 9,
        sessionType: "lecture",
        code: "L09",
        title: "Center point",
        date: "2026-02-09",
        scheduleOverrideLabel: null,
        description: null,
        format: null,
        notes: null,
        status: "scheduled",
        instructionalMode: "recovery",
        canceledAt: null,
        canceledReason: null,
        archivedAt: null,
      },
    ]),
    listCalendarSlots: vi.fn(async () => calendarSlots),
    computeCoverageHealth: vi.fn(async () => ({
      fullyCovered: 1,
      partiallyCovered: 0,
      uncovered: 0,
      totalTopics: 1,
    })),
    listTermAssessments: vi.fn(async () => []),
    listTopics: vi.fn(async () => []),
    transitionTerm,
    createDeliveredRevision: vi.fn(async () => {
      throw new Error("createDeliveredRevision should not be called in this test");
    }),
  };

  return { backend, transitionTerm, adoptTermLearningModule };
}

describe("TermWorkspacePage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-02-09T15:00:00.000Z"));
  });

  afterEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("reviews lifecycle transitions before applying and can expand the calendar window", async () => {
    const { backend, transitionTerm } = buildTermWorkspaceBackend();
    setMockBackend(backend);

    render(<TermWorkspacePage termId="term-1" />);

    await screen.findByText("Calendar timeline");
    expect(screen.getByText("Plan workspace")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Term workspace sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "#term-calendar");
    expect(screen.getByText("Reduced capacity")).toBeInTheDocument();
    expect(screen.getByText("Recovery capacity")).toBeInTheDocument();
    expect(screen.getByText("Assessment-period capacity")).toBeInTheDocument();
    expect(screen.queryByText("Provenance:")).not.toBeInTheDocument();
    expect(screen.getByText("Mode: Recovery")).toBeInTheDocument();
    expect(screen.getByText("2026-02-09")).toBeInTheDocument();

    const baselineRow = screen.getByText("2026-02-05", { selector: "span" }).closest("div");
    expect(baselineRow).not.toBeNull();
    if (!baselineRow) throw new Error("Expected the baseline calendar row to exist.");
    const baselineWithin = within(baselineRow);
    expect(baselineWithin.getByText("Normal capacity")).toBeInTheDocument();
    expect(baselineWithin.queryByText("Capacity source:")).not.toBeInTheDocument();
    expect(baselineWithin.queryByText("Schedule source:")).not.toBeInTheDocument();

    const advisoryRow = screen.getByText("2026-02-11").closest("div");
    expect(advisoryRow).not.toBeNull();
    if (!advisoryRow) throw new Error("Expected the advisory calendar row to exist.");
    const advisoryWithin = within(advisoryRow);
    expect(advisoryWithin.getByText("Assessment-period capacity")).toBeInTheDocument();
    expect(advisoryWithin.getByText("Capacity source: Instructor override")).toBeInTheDocument();
    expect(advisoryWithin.getByText("Schedule source: meeting_roles:lecture")).toBeInTheDocument();
    expect(advisoryWithin.getByText("Assessment period session with tightened instructional load.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    await screen.findByText("2026-02-01");

    fireEvent.click(screen.getByRole("button", { name: "Activate term" }));
    await screen.findByText("Activate this term?");
    expect(transitionTerm).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Activate term" })[1]!);

    await waitFor(() => {
      expect(transitionTerm).toHaveBeenCalledWith("term-1", "activate", "planned");
    });
    await screen.findByRole("button", { name: "Close term" });
    expect(screen.getByText("Run workspace")).toBeInTheDocument();
  });

  it("adopts a course learning module into the term workspace", async () => {
    const { backend, adoptTermLearningModule } = buildTermWorkspaceBackend();
    setMockBackend(backend);

    render(<TermWorkspacePage termId="term-1" />);

    await screen.findByRole("button", { name: "Adopt learning module" });
    fireEvent.click(screen.getByRole("button", { name: "Adopt learning module" }));
    await screen.findByLabelText("Learning module");

    fireEvent.click(screen.getByRole("button", { name: "Adopt learning module" }));

    await waitFor(() => {
      expect(adoptTermLearningModule).toHaveBeenCalledWith("term-1", {
        learningModuleId: "learning-module-1",
        learningModuleVersionId: "learning-module-version-1",
        sequence: 1,
        notes: null,
      });
    });

    await screen.findByText("Probability Foundations");
    expect(screen.getByText("All course learning modules are already adopted for this term.")).toBeInTheDocument();
  });
});
