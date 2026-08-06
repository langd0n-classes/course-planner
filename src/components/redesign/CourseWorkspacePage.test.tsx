// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type {
  AcademicCalendarDto,
  ActivityTypeDto,
  ActivityTypeVersionDto,
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
  activityTypes?: Array<{ activityType: ActivityTypeDto; currentVersion: ActivityTypeVersionDto }>;
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
  const activityTypes = [...(options?.activityTypes ?? [])];

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
      versionInput: { title: string; category?: string | null },
    ) => {
      const topic: TopicDto = {
        id: `topic-${topics.length + 1}`,
        courseId: course.id,
        learningModuleId: null,
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

  const updateTopic = vi.fn(
    async (
      topicId: string,
      input: { stableCode?: string },
    ) => {
      const entry = topics.find((candidate) => candidate.topic.id === topicId);
      if (!entry) throw new Error(`Unknown topic ${topicId}`);
      entry.topic = {
        ...entry.topic,
        stableCode: input.stableCode ?? entry.topic.stableCode,
        learningModuleId: entry.topic.learningModuleId,
      };
      return { topic: entry.topic, currentVersion: entry.currentVersion };
    },
  );

  const createTopicVersion = vi.fn(
    async (
      topicId: string,
      input: { title: string; category?: string | null },
    ) => {
      const entry = topics.find((candidate) => candidate.topic.id === topicId);
      if (!entry) throw new Error(`Unknown topic ${topicId}`);
      entry.currentVersion = {
        ...entry.currentVersion,
        id: `${entry.currentVersion.id}-r${entry.currentVersion.revision + 1}`,
        revision: entry.currentVersion.revision + 1,
        title: input.title,
        category: input.category ?? null,
      };
      entry.topic.currentVersionId = entry.currentVersion.id;
      return entry.currentVersion;
    },
  );

  const createActivityType = vi.fn(
    async (input: {
      behaviorFamily: "meeting" | "coursework" | "assessment";
      version: { label: string; description?: string | null };
    }) => {
      const activityType: ActivityTypeDto = {
        id: `activity-type-${activityTypes.length + 1}`,
        instructorId: "instructor-1",
        behaviorFamily: input.behaviorFamily,
        currentVersionId: `activity-type-version-${activityTypes.length + 1}`,
        archivedAt: null,
      };
      const currentVersion: ActivityTypeVersionDto = {
        id: activityType.currentVersionId!,
        activityTypeId: activityType.id,
        revision: 1,
        label: input.version.label,
        description: input.version.description ?? null,
        changeSummary: null,
        publishedAt: "2026-07-15T00:00:00.000Z",
      };
      activityTypes.push({ activityType, currentVersion });
      return { activityType, currentVersion };
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
    updateTopic,
    createTopicVersion,
    listTopicPrerequisites: vi.fn(async () => []),
    replaceTopicPrerequisites: vi.fn(async () => []),
    listActivityTypes: vi.fn(async () => activityTypes.map((entry) => entry.activityType)),
    listActivityTypeVersions: vi.fn(async (activityTypeId: string) => {
      const entry = activityTypes.find((candidate) => candidate.activityType.id === activityTypeId);
      return entry ? [entry.currentVersion] : [];
    }),
    createActivityType,
  };

  return {
    backend,
    createInstitution,
    replaceCourseInstitutions,
    createAcademicCalendar,
    createLearningModule,
    createTopic,
    updateTopic,
    createTopicVersion,
    createActivityType,
  };
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
    fireEvent.change(screen.getByLabelText("Topic title"), {
      target: { value: "Pandas basics" },
    });
    const topicCodeInput = screen.getByLabelText("Topic code");
    fireEvent.keyDown(topicCodeInput, { key: "Tab" });
    fireEvent.change(screen.getByLabelText("Category (optional)"), {
      target: { value: "tools" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create topic" }));

    await waitFor(() => {
      expect(createTopic).toHaveBeenCalledWith("course-1", "topic-pandas-basics", {
        title: "Pandas basics",
        category: "tools",
      });
    });
  });

  it("shows prerequisite-led term empty states and opens the missing setup step", async () => {
    const { backend } = buildCourseWorkspaceBackend();
    setMockBackend(backend);

    render(<CourseWorkspacePage courseId="course-1" />);

    await screen.findByRole("button", { name: "Link institution to create a term" });
    fireEvent.click(screen.getByRole("button", { name: "Link institution to create a term" }));

    expect(await screen.findByLabelText("Institution name")).toBeInTheDocument();
  });

  it("saves compact topic edits through the real topic identity and version handlers", async () => {
    const { backend, updateTopic, createTopicVersion } = buildCourseWorkspaceBackend({
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
      topics: [
        {
          topic: {
            id: "topic-1",
            courseId: "course-1",
            learningModuleId: null,
            stableCode: "topic-selecting",
            currentVersionId: "topic-version-1",
            archivedAt: null,
          },
          currentVersion: {
            id: "topic-version-1",
            topicId: "topic-1",
            revision: 1,
            title: "Selecting",
            category: "SQL",
            description: null,
            changeSummary: null,
            publishedAt: null,
          },
        },
      ],
    });
    setMockBackend(backend);

    render(<CourseWorkspacePage courseId="course-1" />);

    await screen.findByDisplayValue("Selecting");
    fireEvent.change(screen.getByLabelText("Topic title"), {
      target: { value: "Selecting rows" },
    });
    fireEvent.change(screen.getByLabelText("Topic code"), {
      target: { value: "topic-selecting-rows" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));

    await waitFor(() => {
      expect(updateTopic).toHaveBeenCalledWith("topic-1", {
        stableCode: "topic-selecting-rows",
      });
      expect(createTopicVersion).toHaveBeenCalledWith("topic-1", {
        expectedCurrentVersionId: "topic-version-1",
        title: "Selecting rows",
        category: "SQL",
        description: null,
        publish: false,
      });
    });
  });

  it("authors instructor activity types with a custom label distinct from the stable behavior family", async () => {
    const { backend, createActivityType } = buildCourseWorkspaceBackend({
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

    await screen.findByRole("heading", { name: "Activity types" });
    fireEvent.click(screen.getByRole("button", { name: "New activity type" }));
    fireEvent.change(screen.getByLabelText("Activity type label"), {
      target: { value: "Discussion" },
    });
    fireEvent.change(screen.getByLabelText("Stable behavior family"), {
      target: { value: "meeting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create activity type" }));

    await waitFor(() => {
      expect(createActivityType).toHaveBeenCalledWith({
        behaviorFamily: "meeting",
        version: {
          label: "Discussion",
          description: null,
          publish: true,
        },
      });
    });

    await screen.findByText("Discussion");
    expect(screen.getByText("meeting")).toBeInTheDocument();
    expect(screen.getByText("Historical version 1")).toBeInTheDocument();
  });
});

describe("CourseWorkspacePage activity board moves", () => {
  afterEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
  });

  const activity = { id: "a-1", courseId: "course-1", stableCode: "W1", currentVersionId: "av-1", archivedAt: null };
  const activityVersion = {
    id: "av-1",
    activityId: "a-1",
    revision: 1,
    title: "Probability workshop",
    summary: null,
    activityTypeVersionId: "type-1",
    changeSummary: null,
    publishedAt: null,
    detail: { behaviorFamily: "meeting" as const, defaultDurationMinutes: null, modality: null, preparationNotes: null, authoringNotes: null },
    milestoneTemplates: [],
  };

  function lmEntry(id: string, versionId: string, activities: Array<{ activityVersionId: string; sequence: number; notes: string | null }>) {
    const learningModule: LearningModuleDto = { id, courseId: "course-1", stableCode: id.toUpperCase(), currentVersionId: versionId, archivedAt: null };
    const currentVersion = {
      id: versionId,
      learningModuleId: id,
      revision: 1,
      title: `Module ${id}`,
      description: null,
      studentDescription: null,
      learningObjectives: [],
      notes: null,
      defaultSequence: id === "lm-1" ? 1 : 2,
      changeSummary: null,
      publishedAt: "2026-01-01T00:00:00Z",
      topics: [],
      activities,
    } as unknown as LearningModuleVersionDto;
    return { learningModule, currentVersion };
  }

  function renderBoardWorkspace(
    impl: (learningModuleId: string, version: UpsertLearningModuleVersionRequest) => Promise<LearningModuleVersionDto>,
  ) {
    const createLearningModuleVersion = vi.fn(impl);
    const { backend } = buildCourseWorkspaceBackend({
      learningModules: [
        lmEntry("lm-1", "lmv-1", [{ activityVersionId: "av-1", sequence: 1, notes: null }]),
        lmEntry("lm-2", "lmv-2", []),
      ],
    });
    setMockBackend({
      ...backend,
      listCourseActivities: vi.fn(async () => [activity]),
      getActivity: vi.fn(async () => ({ activity, currentVersion: activityVersion })),
      listActivityTopicActions: vi.fn(async () => []),
      listActivityLmScope: vi.fn(async () => []),
      createLearningModuleVersion,
    });
    render(<CourseWorkspacePage courseId="course-1" />);
    return createLearningModuleVersion;
  }

  it("revises the destination module before removing from the source", async () => {
    const createLearningModuleVersion = renderBoardWorkspace(
      async (learningModuleId) => ({ id: `new-${learningModuleId}` }) as unknown as LearningModuleVersionDto,
    );

    const control = await screen.findByLabelText("Move Probability workshop to");
    fireEvent.change(control, { target: { value: "lm-2" } });

    await waitFor(() => expect(createLearningModuleVersion).toHaveBeenCalledTimes(2));
    expect(createLearningModuleVersion.mock.calls.map((call) => call[0])).toEqual(["lm-2", "lm-1"]);
    expect(createLearningModuleVersion.mock.calls[0]?.[1]).toMatchObject({
      expectedCurrentVersionId: "lmv-2",
      activities: [{ activityVersionId: "av-1", sequence: 1, notes: null }],
      publish: true,
    });
    expect(createLearningModuleVersion.mock.calls[1]?.[1]).toMatchObject({
      expectedCurrentVersionId: "lmv-1",
      activities: [],
    });
  });

  it("keeps the card in its source module when the destination revision fails", async () => {
    const createLearningModuleVersion = renderBoardWorkspace(async (learningModuleId) => {
      if (learningModuleId === "lm-2") throw new Error("Concurrent edit detected");
      return { id: `new-${learningModuleId}` } as unknown as LearningModuleVersionDto;
    });

    const control = await screen.findByLabelText("Move Probability workshop to");
    fireEvent.change(control, { target: { value: "lm-2" } });

    await screen.findByText("Concurrent edit detected");
    expect(createLearningModuleVersion).toHaveBeenCalledTimes(1);
    expect(createLearningModuleVersion.mock.calls[0]?.[0]).toBe("lm-2");
  });
});
