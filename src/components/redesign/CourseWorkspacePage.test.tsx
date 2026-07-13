// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type {
  AcademicCalendarDto,
  CourseDto,
  LearningModuleDto,
  LearningModuleVersionDto,
  TopicDto,
  TopicVersionDto,
  UpsertLearningModuleVersionRequest,
} from "@/lib/redesign-contract";
import CourseWorkspacePage from "./CourseWorkspacePage";

function buildCourseWorkspaceBackend(options?: {
  linkedInstitutions?: Array<{ id: string; name: string; shortName: string | null }>;
  calendars?: AcademicCalendarDto[];
  learningModules?: Array<{ learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto }>;
  topics?: Array<{ topic: TopicDto; currentVersion: TopicVersionDto }>;
}) {
  const course: CourseDto = {
    id: "course-1",
    instructorId: "instuctor-1",
    shortId: "CP-101",
    title: "Course Planning Studio",
    titleIsPlaceholder: false,
    number: "EDUC 210",
    numberIsPlaceholder: false,
    description: "A redesign test fixture.",
    archivedAt: null,
  };

  const allInstitutions = [...(options?.linkedInstitutions ?? [])].map((institution) => ({
    ...institution,
    canonicalUri: null,
    archivedAt: null,
  }));
  let linkedInstitutionIds = allInstitutions.map((institution) => institution.id);
  const calendarsByInstitution = new Map<string, AcademicCalendarDto[]>();
  for (const calendar of options?.calendars ?? []) {
    calendarsByInstitution.set(calendar.institutionId, [
      ...(calendarsByInstitution.get(calendar.institutionId) ?? []),
      calendar,
    ]);
  }

  const learningModules = [...(options?.learningModules ?? [])];
  const topics = [...(options?.topics ?? [])];

  const createInstitution = vi.fn(async (input: { name: string; shortName?: string | null }) => {
    const institution = {
      id: `institution-${allInstitutions.length + 1}`,
      name: input.name,
      shortName: input.shortName ?? null,
      canonicalUri: null,
      archivedAt: null,
    };
    allInstitutions.push(institution);
    return institution;
  });

  const replaceCourseInstitutions = vi.fn(async (_courseId: string, institutionIds: string[]) => {
    linkedInstitutionIds = [...institutionIds];
    return {
      courseInstitutions: institutionIds.map((institutionId) => ({ courseId: course.id, institutionId })),
    };
  });

  const createAcademicCalendar = vi.fn(
    async (input: { institutionId: string; name: string; academicYear: string; sourceUri?: string | null }) => {
      const calendar: AcademicCalendarDto = {
        id: `calendar-${(calendarsByInstitution.get(input.institutionId)?.length ?? 0) + 1}`,
        institutionId: input.institutionId,
        name: input.name,
        academicYear: input.academicYear,
        version: 1,
        sourceUri: input.sourceUri ?? null,
        publishedAt: null,
        archivedAt: null,
      };
      calendarsByInstitution.set(input.institutionId, [
        ...(calendarsByInstitution.get(input.institutionId) ?? []),
        calendar,
      ]);
      return calendar;
    },
  );

  const createLearningModule = vi.fn(
    async (
      _courseId: string,
      stableCode: string,
      versionInput: UpsertLearningModuleVersionRequest,
    ) => {
      const learningModule: LearningModuleDto = {
        id: `learning-module-${learningModules.length + 1}`,
        courseId: course.id,
        stableCode,
        currentVersionId: `learning-module-version-${learningModules.length + 1}`,
        archivedAt: null,
      };
      const currentVersion: LearningModuleVersionDto = {
        id: learningModule.currentVersionId!,
        learningModuleId: learningModule.id,
        revision: 1,
        title: versionInput.title,
        description: versionInput.description ?? null,
        studentDescription: null,
        learningObjectives: versionInput.learningObjectives ?? [],
        notes: null,
        defaultSequence: learningModules.length + 1,
        changeSummary: null,
        publishedAt: null,
        topics: [],
      };
      learningModules.push({ learningModule, currentVersion });
      return { learningModule, currentVersion };
    },
  );

  const createTopic = vi.fn(
    async (
      _courseId: string,
      stableCode: string,
      learningModuleId: string | null,
      versionInput: { title: string; category?: string | null },
    ) => {
      const topic: TopicDto = {
        id: `topic-${topics.length + 1}`,
        courseId: course.id,
        learningModuleId,
        stableCode,
        currentVersionId: `topic-version-${topics.length + 1}`,
        archivedAt: null,
      };
      const currentVersion: TopicVersionDto = {
        id: topic.currentVersionId!,
        topicId: topic.id,
        revision: 1,
        title: versionInput.title,
        category: versionInput.category ?? null,
        description: null,
        changeSummary: null,
        publishedAt: null,
      };
      topics.push({ topic, currentVersion });
      return { topic, currentVersion };
    },
  );

  const backend = {
    getCourse: vi.fn(async () => course),
    listInstitutions: vi.fn(async () => [...allInstitutions]),
    listCourseInstitutions: vi.fn(async () =>
      allInstitutions.filter((institution) => linkedInstitutionIds.includes(institution.id)),
    ),
    listTerms: vi.fn(async () => []),
    listAcademicCalendars: vi.fn(async (institutionId?: string) =>
      institutionId
        ? [...(calendarsByInstitution.get(institutionId) ?? [])]
        : [...calendarsByInstitution.values()].flat(),
    ),
    createInstitution,
    replaceCourseInstitutions,
    createAcademicCalendar,
    listLearningModules: vi.fn(async () => learningModules.map((entry) => entry.learningModule)),
    getLearningModule: vi.fn(async (learningModuleId: string) => {
      const entry = learningModules.find((candidate) => candidate.learningModule.id === learningModuleId);
      if (!entry) throw new Error(`Unknown learning module ${learningModuleId}`);
      return { learningModule: entry.learningModule, currentVersion: entry.currentVersion };
    }),
    listLearningModuleVersions: vi.fn(async (learningModuleId: string) => {
      const entry = learningModules.find((candidate) => candidate.learningModule.id === learningModuleId);
      return entry ? [entry.currentVersion] : [];
    }),
    createLearningModule,
    restoreLearningModuleVersion: vi.fn(async () => {
      throw new Error("restoreLearningModuleVersion should not be called in this test");
    }),
    listTopics: vi.fn(async () => topics.map((entry) => entry.topic)),
    getTopic: vi.fn(async (topicId: string) => {
      const entry = topics.find((candidate) => candidate.topic.id === topicId);
      if (!entry) throw new Error(`Unknown topic ${topicId}`);
      return { topic: entry.topic, currentVersion: entry.currentVersion };
    }),
    getTopicVersion: vi.fn(async (topicVersionId: string) => {
      const entry = topics.find((candidate) => candidate.currentVersion.id === topicVersionId);
      if (!entry) throw new Error(`Unknown topic version ${topicVersionId}`);
      return entry.currentVersion;
    }),
    createTopic,
    listTopicPrerequisites: vi.fn(async () => []),
    assignTopicLearningModule: vi.fn(async () => {
      throw new Error("assignTopicLearningModule should not be called in this test");
    }),
    replaceTopicPrerequisites: vi.fn(async () => []),
  };

  return { backend, createInstitution, replaceCourseInstitutions, createAcademicCalendar, createLearningModule, createTopic };
}

describe("CourseWorkspacePage", () => {
  afterEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
  });

  it("bootstraps an institution and academic calendar from the workspace", async () => {
    const { backend, createInstitution, replaceCourseInstitutions, createAcademicCalendar } = buildCourseWorkspaceBackend();
    setMockBackend(backend);

    render(<CourseWorkspacePage courseId="course-1" />);

    await screen.findByText("Design workspace");
    expect(screen.getByRole("navigation", { name: "Course workspace sections" })).toBeInTheDocument();
    expect(screen.getByLabelText("Course setup progress")).toBeInTheDocument();
    await screen.findByText("Link an institution");
    fireEvent.click(screen.getByRole("button", { name: "Create institution" }));
    fireEvent.change(screen.getByLabelText("Institution name"), {
      target: { value: "University of Example" },
    });
    fireEvent.change(screen.getByLabelText("Short name (optional)"), {
      target: { value: "UExample" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create and link" }));

    await waitFor(() => {
      expect(createInstitution).toHaveBeenCalledWith({
        name: "University of Example",
        shortName: "UExample",
      });
      expect(replaceCourseInstitutions).toHaveBeenCalled();
    });

    await screen.findByText("Add an academic calendar");
    fireEvent.click(screen.getByRole("button", { name: "Create academic calendar" }));
    fireEvent.change(screen.getByLabelText("Calendar name"), {
      target: { value: "AY 2026-27" },
    });
    fireEvent.change(screen.getByLabelText("Academic year"), {
      target: { value: "2026-27" },
    });
    fireEvent.change(screen.getByLabelText("Source URL (optional)"), {
      target: { value: "https://registrar.example.edu/calendar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create calendar" }));

    await waitFor(() => {
      expect(createAcademicCalendar).toHaveBeenCalledWith({
        institutionId: "institution-1",
        name: "AY 2026-27",
        academicYear: "2026-27",
        sourceUri: "https://registrar.example.edu/calendar",
      });
    });
  });

  it("creates a learning module and a topic from the course workspace", async () => {
    const { backend, createLearningModule, createTopic } = buildCourseWorkspaceBackend({
      linkedInstitutions: [{ id: "institution-1", name: "University of Example", shortName: "UExample" }],
      calendars: [
        {
          id: "calendar-1",
          institutionId: "institution-1",
          name: "AY 2026-27",
          academicYear: "2026-27",
          version: 1,
          sourceUri: null,
          publishedAt: null,
          archivedAt: null,
        },
      ],
    });
    setMockBackend(backend);

    render(<CourseWorkspacePage courseId="course-1" />);

    await screen.findByRole("heading", { name: "Learning modules" });
    fireEvent.click(screen.getByRole("button", { name: "New module" }));
    fireEvent.change(await screen.findByLabelText(/^Stable code/), {
      target: { value: "lm-intro-ds" },
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Introduction to Data Science" },
    });
    fireEvent.change(screen.getByLabelText("Learning objectives (one per line, optional)"), {
      target: { value: "Understand the data lifecycle\nFrame a course plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create module" }));

    await waitFor(() => {
      expect(createLearningModule).toHaveBeenCalledWith("course-1", "lm-intro-ds", {
        title: "Introduction to Data Science",
        description: null,
        learningObjectives: ["Understand the data lifecycle", "Frame a course plan"],
      });
    });

    await screen.findByRole("heading", { name: "Introduction to Data Science" });
    fireEvent.click(screen.getByRole("button", { name: "New topic" }));
    fireEvent.change(await screen.findByLabelText(/^Stable code/), {
      target: { value: "topic-pandas-basics" },
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Pandas basics" },
    });
    fireEvent.change(screen.getByLabelText("Category (optional)"), {
      target: { value: "tools" },
    });
    fireEvent.change(screen.getByLabelText(/^Learning module \(optional\)/), {
      target: { value: "learning-module-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create topic" }));

    await waitFor(() => {
      expect(createTopic).toHaveBeenCalledWith("course-1", "topic-pandas-basics", "learning-module-1", {
        title: "Pandas basics",
        category: "tools",
      });
    });
  });
});
