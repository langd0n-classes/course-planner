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
  UpsertTopicVersionRequest,
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

  const createLearningModuleVersion = vi.fn(async (id: string, input: UpsertLearningModuleVersionRequest) => {
    const entry = learningModules.find((item) => item.learningModule.id === id)!;
    entry.currentVersion = {
      ...entry.currentVersion, ...input,
      id: `${entry.currentVersion.id}-next`, revision: entry.currentVersion.revision + 1, publishedAt: null,
    };
    entry.learningModule.currentVersionId = entry.currentVersion.id;
    return entry.currentVersion;
  });
  const publishLearningModuleVersion = vi.fn(async (versionId: string) => {
    const entry = learningModules.find((item) => item.currentVersion.id === versionId)!;
    entry.currentVersion = { ...entry.currentVersion, publishedAt: "2026-10-04T00:00:00.000Z" };
    return entry.currentVersion;
  });

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
      input: UpsertTopicVersionRequest,
    ) => {
      const entry = topics.find((candidate) => candidate.topic.id === topicId);
      if (!entry) throw new Error(`Unknown topic ${topicId}`);
      entry.currentVersion = {
        ...entry.currentVersion,
        id: `${entry.currentVersion.id}-r${entry.currentVersion.revision + 1}`,
        revision: entry.currentVersion.revision + 1,
        title: input.title,
        category: input.category ?? null,
        description: input.description ?? null,
        changeSummary: input.changeSummary ?? null,
        publishedAt: null,
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
    createLearningModuleVersion,
    publishLearningModuleVersion,
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
    listCourseActivities: vi.fn(async () => []),
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
    createLearningModuleVersion,
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

  it("shows loading, then offers a retry after a workspace load failure", async () => {
    const { backend } = buildCourseWorkspaceBackend();
    backend.getCourse.mockRejectedValueOnce(new Error("Workspace service unavailable"));
    setMockBackend(backend);
    render(<CourseWorkspacePage courseId="course-1" />);
    expect(document.querySelector(".animate-pulse")).not.toBeNull();
    expect(await screen.findByText("Workspace service unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Learning modules" });
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
        changeSummary: null,
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

describe("workspace version editors", () => {
  it("publishes the current draft without creating another version", async () => {
    const draft: LearningModuleVersionDto = {
      id: "lm-draft", learningModuleId: "lm-1", revision: 2, title: "Draft module",
      description: null, studentDescription: null, learningObjectives: [], notes: null,
      defaultSequence: 0, changeSummary: null, publishedAt: null, topics: [], activities: [],
    };
    const { backend, createLearningModuleVersion } = buildCourseWorkspaceBackend({ learningModules: [{
      learningModule: { id: "lm-1", courseId: "course-1", stableCode: "LM1", currentVersionId: draft.id, archivedAt: null },
      currentVersion: draft,
    }] });
    setMockBackend(backend);
    render(<CourseWorkspacePage courseId="course-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Draft module" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish draft" }));
    await waitFor(() => expect(backend.publishLearningModuleVersion).toHaveBeenCalledWith("lm-draft"));
    expect(createLearningModuleVersion).not.toHaveBeenCalled();
    await screen.findByText(/Revision 2 · Published/);
  });

  it("opens a published module, saves a new version, and refreshes its title and revision", async () => {
    const original: LearningModuleVersionDto = {
      id: "lm-v1", learningModuleId: "lm-1", revision: 1, title: "Original module",
      description: "Description", studentDescription: "Student text", learningObjectives: ["Objective"],
      notes: "Notes", defaultSequence: 0, changeSummary: null, publishedAt: "2026-01-01T00:00:00Z",
      topics: [], activities: [],
    };
    const { backend, createLearningModuleVersion } = buildCourseWorkspaceBackend({ learningModules: [{
      learningModule: { id: "lm-1", courseId: "course-1", stableCode: "LM1", currentVersionId: original.id, archivedAt: null },
      currentVersion: original,
    }] });
    setMockBackend(backend);
    render(<CourseWorkspacePage courseId="course-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Original module" }));
    fireEvent.change(screen.getByLabelText("Module title"), { target: { value: "Updated module" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save new version" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
    await screen.findByRole("button", { name: "Updated module" });
    expect(createLearningModuleVersion).toHaveBeenCalledWith("lm-1", expect.objectContaining({ expectedCurrentVersionId: "lm-v1", title: "Updated module", publish: false, activities: [] }));
    expect(screen.queryByRole("form", { name: "Learning module editor" })).not.toBeInTheDocument();
    expect(original.title).toBe("Original module");
    expect(original.revision).toBe(1);
  });

  it("keeps the selected Topic open after a description-only revision", async () => {
    const original: TopicVersionDto = { id: "tv1", topicId: "t1", revision: 1, title: "Original topic", category: "Concept", description: "Old description", changeSummary: null, publishedAt: "2026-01-01T00:00:00Z" };
    const { backend, createTopicVersion, updateTopic } = buildCourseWorkspaceBackend({ topics: [{
      topic: { id: "t0", courseId: "course-1", learningModuleId: null, stableCode: "T0", currentVersionId: "tv0", archivedAt: null },
      currentVersion: { ...original, id: "tv0", topicId: "t0", title: "First topic", description: "First description" },
    }, {
      topic: { id: "t1", courseId: "course-1", learningModuleId: null, stableCode: "T1", currentVersionId: "tv1", archivedAt: null }, currentVersion: original,
    }] });
    setMockBackend(backend);
    render(<CourseWorkspacePage courseId="course-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Original topic/ }));
    await screen.findByDisplayValue("Old description");
    fireEvent.change(screen.getByLabelText("Topic description"), { target: { value: "Expanded description" } });
    fireEvent.change(screen.getByLabelText("Topic change summary"), { target: { value: "Clarify meaning" } });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await screen.findByText("Last change: Clarify meaning");
    expect(screen.getByLabelText("Topic description")).toHaveValue("Expanded description");
    expect(createTopicVersion).toHaveBeenCalledWith("t1", { expectedCurrentVersionId: "tv1", title: "Original topic", category: "Concept", description: "Expanded description", changeSummary: "Clarify meaning", publish: false });
    expect(updateTopic).not.toHaveBeenCalled();
    expect(original.description).toBe("Old description");
  });

  it("does not change prerequisites when Topic version creation fails", async () => {
    const original: TopicVersionDto = { id: "tv1", topicId: "t1", revision: 1, title: "Original topic", category: "Concept", description: "Old description", changeSummary: null, publishedAt: null };
    const { backend, createTopicVersion } = buildCourseWorkspaceBackend({ topics: [{
      topic: { id: "t1", courseId: "course-1", learningModuleId: null, stableCode: "T1", currentVersionId: "tv1", archivedAt: null }, currentVersion: original,
    }] });
    createTopicVersion.mockRejectedValueOnce(new Error("Concurrent edit detected"));
    setMockBackend(backend);
    render(<CourseWorkspacePage courseId="course-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Original topic/ }));
    fireEvent.change(screen.getByLabelText("Topic description"), { target: { value: "New description" } });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await screen.findByText("Concurrent edit detected");
    expect(backend.replaceTopicPrerequisites).not.toHaveBeenCalled();
  });

  it("retries a partial Topic save without creating another version", async () => {
    const original: TopicVersionDto = { id: "tv1", topicId: "t1", revision: 1, title: "Original topic", category: "Concept", description: "Old description", changeSummary: null, publishedAt: null };
    const { backend, createTopicVersion, updateTopic } = buildCourseWorkspaceBackend({ topics: [{
      topic: { id: "t1", courseId: "course-1", learningModuleId: null, stableCode: "T1", currentVersionId: "tv1", archivedAt: null }, currentVersion: original,
    }] });
    updateTopic.mockRejectedValueOnce(new Error("Code already in use"));
    setMockBackend(backend);
    render(<CourseWorkspacePage courseId="course-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /Original topic/ }));
    fireEvent.change(screen.getByLabelText("Topic description"), { target: { value: "Expanded description" } });
    fireEvent.change(screen.getByLabelText("Topic code"), { target: { value: "T1-NEW" } });
    fireEvent.change(screen.getByLabelText("Topic change summary"), { target: { value: "Clarify meaning" } });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));

    await screen.findByText("Code already in use");
    await screen.findByText("Last change: Clarify meaning");
    expect(createTopicVersion).toHaveBeenCalledTimes(1);
    expect(updateTopic).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Topic code"), { target: { value: "T1-NEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));

    await waitFor(() => expect(updateTopic).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(backend.replaceTopicPrerequisites).toHaveBeenCalledTimes(1));
    expect(createTopicVersion).toHaveBeenCalledTimes(1);
    expect(createTopicVersion).toHaveBeenCalledWith("t1", expect.objectContaining({ expectedCurrentVersionId: "tv1" }));
  });
});
