/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import {
  hardRemoveTopic,
  previewHardRemoval,
  setArchivedState,
} from "./archive-removal-service";
import { createArtifact } from "./artifact-service";
import { previewTermClone } from "./clone-service";
import { createCourse } from "./course-service";
import { ConcurrencyConflictError, DomainInvariantError, ImmutablePublishedVersionError } from "./errors";
import { assertAcyclicTopicPrerequisite, assertSameCourse } from "./invariants";
import { transitionTermLifecycle } from "./lifecycle-service";
import { computePlannedDeliveredDiff, createDeliveredRevision } from "./offering-service";
import { assertPublishedLearningModuleVersionImmutable, reviseLearningModule } from "./revision-service";
import { createTerm } from "./term-service";

function createTransactionalDb(tx: Record<string, any>) {
  return {
    $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) => fn(tx),
  };
}

describe("term lifecycle concurrency", () => {
  it("changes status with an atomic expected-status predicate", async () => {
    let updateWhere: Record<string, unknown> | null = null;
    const db = createTransactionalDb({
      term: {
        findUnique: async () => ({ id: "term-1", status: "planned", closedAt: null }),
        updateMany: async ({ where }: any) => {
          updateWhere = where;
          return { count: 1 };
        },
      },
    });

    const term = await transitionTermLifecycle(db, {
      termId: "term-1",
      transition: "activate",
      expectedStatus: "planned",
    });

    expect(updateWhere).toEqual({ id: "term-1", status: "planned" });
    expect(term.status).toBe("active");
  });

  it("rejects a race lost between the status read and update", async () => {
    const db = createTransactionalDb({
      term: {
        findUnique: async () => ({ id: "term-1", status: "planned", closedAt: null }),
        updateMany: async () => ({ count: 0 }),
      },
    });

    await expect(
      transitionTermLifecycle(db, {
        termId: "term-1",
        transition: "activate",
        expectedStatus: "planned",
      }),
    ).rejects.toThrow(ConcurrencyConflictError);
  });
});

describe("redesign service invariants", () => {
  it("requires an Artifact parent to be singular and agree with parentType", async () => {
    const db = createTransactionalDb({
      artifact: {
        create: async ({ data }: any) => data,
      },
    });

    await expect(
      createArtifact(db, {
        parentType: "session",
        sessionId: "session-1",
        assessmentId: "assessment-1",
        artifactType: "slides",
        sourceType: "external_uri",
        title: "Slides",
        uri: "https://example.edu/slides",
      }),
    ).rejects.toThrow(DomainInvariantError);

    await expect(
      createArtifact(db, {
        parentType: "session",
        assessmentId: "assessment-1",
        artifactType: "slides",
        sourceType: "external_uri",
        title: "Slides",
        uri: "https://example.edu/slides",
      }),
    ).rejects.toThrow("parent foreign key must agree");
  });

  it("requires durable URIs for uploaded and generated artifacts", async () => {
    const db = createTransactionalDb({
      artifact: {
        create: async ({ data }: any) => data,
      },
    });

    await expect(
      createArtifact(db, {
        parentType: "topic_version",
        topicVersionId: "topic-version-1",
        artifactType: "dataset",
        sourceType: "uploaded_file",
        title: "Dataset",
        uri: "file:///tmp/dataset.csv",
      }),
    ).rejects.toThrow("durable object-storage");
  });

  it("accepts remote Artifacts for generic external resources", async () => {
    const db = createTransactionalDb({
      artifact: {
        create: async ({ data }: any) => data,
      },
    });

    await expect(
      createArtifact(db, {
        parentType: "topic_version",
        topicVersionId: "topic-version-1",
        artifactType: "reading",
        sourceType: "external_uri",
        title: "Reference deck",
        uri: "https://slides.example.edu/week-01",
      }),
    ).resolves.toMatchObject({
      parentType: "topic_version",
      artifactType: "reading",
      sourceType: "external_uri",
      uri: "https://slides.example.edu/week-01",
    });
  });

  it("rejects cross-Course prerequisites and cloning boundaries", () => {
    expect(() => assertSameCourse("course-a", "course-b", "Topic prerequisites")).toThrow(
      "cannot cross Course boundaries",
    );
  });

  it("rejects prerequisite cycles", () => {
    expect(() =>
      assertAcyclicTopicPrerequisite("topic-a", "topic-c", [
        { topicId: "topic-c", prerequisiteTopicId: "topic-b" },
        { topicId: "topic-b", prerequisiteTopicId: "topic-a" },
      ]),
    ).toThrow("cycle");
  });
});

describe("archive and hard-removal semantics", () => {
  it("archives and restores records by toggling archivedAt", async () => {
    const updates: any[] = [];
    const db = createTransactionalDb({
      artifact: {
        findUnique: async () => ({ id: "artifact-1" }),
        update: async ({ data }: any) => {
          updates.push(data);
          return { id: "artifact-1", ...data };
        },
      },
    });

    await setArchivedState(db, "artifact", "artifact-1", new Date("2026-07-12T18:00:00.000Z"));
    await setArchivedState(db, "artifact", "artifact-1", null);

    expect(updates).toEqual([
      { archivedAt: new Date("2026-07-12T18:00:00.000Z") },
      { archivedAt: null },
    ]);
  });

  it("blocks hard removal when a Topic has delivered references", async () => {
    const db = createTransactionalDb({
      topic: {
        findUnique: async () => ({ id: "topic-1" }),
      },
      learningModuleVersionTopic: {
        count: async () => 1,
      },
      coverage: {
        count: async () => 0,
      },
      assessmentTopic: {
        count: async () => 2,
      },
      artifact: {
        count: async () => 0,
      },
    });

    await expect(previewHardRemoval(db, "topic", "topic-1")).resolves.toMatchObject({
      canRemove: false,
      blockers: [
        { code: "learning_module_snapshots_exist", count: 1 },
        { code: "assessment_links_exist", count: 2 },
      ],
    });
  });

  it("hard-removes an unused Topic graph", async () => {
    const deleted: string[] = [];
    const db = createTransactionalDb({
      topic: {
        findUnique: async () => ({ id: "topic-1" }),
        delete: async () => {
          deleted.push("topic");
          return { id: "topic-1" };
        },
      },
      learningModuleVersionTopic: {
        count: async () => 0,
      },
      coverage: {
        count: async () => 0,
      },
      assessmentTopic: {
        count: async () => 0,
      },
      artifact: {
        count: async () => 0,
      },
      topicPrerequisite: {
        deleteMany: async () => {
          deleted.push("topic_prerequisites");
          return { count: 0 };
        },
      },
      topicVersion: {
        deleteMany: async () => {
          deleted.push("topic_versions");
          return { count: 1 };
        },
      },
    });

    await hardRemoveTopic(db, "topic-1");

    expect(deleted).toEqual(["topic_prerequisites", "topic_versions", "topic"]);
  });
});

describe("course short-ID allocator", () => {
  it("increments Instructor.nextCourseSerial in the same transaction and yields unique serials", async () => {
    let nextCourseSerial = 1;
    const courses: any[] = [];
    const db = createTransactionalDb({
      instructor: {
        update: async () => {
          nextCourseSerial += 1;
          return { nextCourseSerial };
        },
      },
      instructorInstitution: {
        findUnique: async () => ({ status: "active" }),
      },
      courseInstitution: {
        create: async ({ data }: any) => data,
      },
      course: {
        create: async ({ data }: any) => {
          const course = { id: `course-${data.shortId}`, ...data };
          courses.push(course);
          return course;
        },
      },
    });

    const created = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createCourse(db, {
          instructorId: "instructor-1",
          title: `Course ${index}`,
          number: "1XX",
          institutionIds: ["institution-1"],
        }),
      ),
    );

    expect(new Set(created.map((course) => course.shortId)).size).toBe(10);
    expect(created.map((course) => course.shortId)).toEqual([
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
    ]);
    expect(nextCourseSerial).toBe(11);
    expect(courses).toHaveLength(10);
  });
});

describe("term ownership invariants", () => {
  it("requires Term Institution to be linked to both Course and Instructor", async () => {
    const db = createTransactionalDb({
      course: {
        findUnique: async () => ({
          id: "course-1",
          instructorId: "instructor-1",
          institutions: [],
        }),
      },
    });

    await expect(
      createTerm(db, {
        courseId: "course-1",
        academicCalendarId: "calendar-1",
        code: "S26",
        name: "Spring 2026",
        startDate: new Date("2026-01-20"),
        endDate: new Date("2026-05-08"),
      }),
    ).rejects.toThrow("explicit Institution");
  });

  it("requires the Term Academic Calendar to belong to the selected Institution", async () => {
    const db = createTransactionalDb({
      course: {
        findUnique: async () => ({
          id: "course-1",
          instructorId: "instructor-1",
          institutions: [{ institutionId: "institution-1" }],
        }),
      },
      instructorInstitution: {
        findUnique: async () => ({ status: "active" }),
      },
      courseInstitution: {
        findUnique: async () => ({ courseId: "course-1", institutionId: "institution-1" }),
      },
      academicCalendar: {
        findUnique: async () => null,
      },
    });

    await expect(
      createTerm(db, {
        courseId: "course-1",
        institutionId: "institution-1",
        academicCalendarId: "calendar-other",
        code: "S26",
        name: "Spring 2026",
        startDate: new Date("2026-01-20"),
        endDate: new Date("2026-05-08"),
      }),
    ).rejects.toThrow("Academic Calendar must belong");
  });
});

describe("revision subsystem", () => {
  it("editing creates a new Learning Module version and atomically advances currentVersionId", async () => {
    const updates: any[] = [];
    const tx = {
      learningModule: {
        findUnique: async () => ({
          id: "lm-1",
          courseId: "course-1",
          currentVersionId: "lmv-1",
          currentVersion: {
            id: "lmv-1",
            learningModuleId: "lm-1",
            revision: 1,
            publishedAt: new Date(),
          },
        }),
        update: async ({ data }: any) => {
          updates.push(data);
          return data;
        },
      },
      learningModuleVersion: {
        create: async ({ data }: any) => ({
          id: "lmv-2",
          learningModuleId: data.learningModuleId,
          revision: data.revision,
          publishedAt: data.publishedAt,
        }),
      },
      topicVersion: {
        findUnique: async () => {
          throw new Error("No topic snapshots expected");
        },
      },
    };

    const version = await reviseLearningModule(createTransactionalDb(tx), {
      learningModuleId: "lm-1",
      expectedCurrentVersionId: "lmv-1",
      createdByInstructorId: "instructor-1",
      publish: true,
      draft: {
        title: "Probability revised",
        learningObjectives: ["Use probability"],
      },
    });

    expect(version.revision).toBe(2);
    expect(version.publishedAt).toBeInstanceOf(Date);
    expect(updates).toEqual([{ currentVersionId: "lmv-2" }]);
  });

  it("protects published versions from in-place mutation", async () => {
    await expect(
      assertPublishedLearningModuleVersionImmutable(
        {
          learningModuleVersion: {
            findUnique: async () => ({ id: "lmv-1", publishedAt: new Date() }),
          },
        },
        "lmv-1",
      ),
    ).rejects.toThrow(ImmutablePublishedVersionError);
  });
});

describe("delivered revision workflow", () => {
  it("creates an immutable delivered revision and advances only the term-owned delivered pointer", async () => {
    const db = createTransactionalDb({
      termLearningModule: {
        findUnique: async () => ({
          id: "tlm-1",
          learningModuleId: "lm-1",
          courseId: "course-1",
          deliveredLearningModuleVersionId: "lmv-2",
          term: { status: "active" },
        }),
        update: async ({ data }: any) => ({
          id: "tlm-1",
          learningModuleId: "lm-1",
          courseId: "course-1",
          deliveredLearningModuleVersionId: data.deliveredLearningModuleVersionId,
        }),
      },
      learningModule: {
        findUnique: async () => ({ id: "lm-1", courseId: "course-1" }),
      },
      course: {
        findUnique: async () => ({ id: "course-1", instructorId: "instructor-1" }),
      },
      learningModuleVersion: {
        findFirst: async () => ({ id: "lmv-2", revision: 2 }),
        create: async ({ data }: any) => ({
          id: "lmv-3",
          learningModuleId: data.learningModuleId,
          revision: data.revision,
          publishedAt: data.publishedAt,
          topics: data.topics.create,
        }),
      },
      topicVersion: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          topic: { courseId: "course-1", learningModuleId: "lm-1" },
        }),
      },
    });

    const result = await createDeliveredRevision(db, {
      termLearningModuleId: "tlm-1",
      expectedDeliveredLearningModuleVersionId: "lmv-2",
      draft: {
        title: "Delivered revision",
        topics: [{ topicVersionId: "tv-1", sequence: 1 }],
      },
    });

    expect(result.deliveredVersion.id).toBe("lmv-3");
    expect(result.deliveredVersion.revision).toBe(3);
    expect(result.deliveredVersion.publishedAt).toBeInstanceOf(Date);
    expect(result.termLearningModule.deliveredLearningModuleVersionId).toBe("lmv-3");
  });

  it("rejects stale delivered-pointer edits with optimistic concurrency", async () => {
    const db = createTransactionalDb({
      termLearningModule: {
        findUnique: async () => ({
          id: "tlm-1",
          learningModuleId: "lm-1",
          courseId: "course-1",
          deliveredLearningModuleVersionId: "lmv-newer",
          term: { status: "active" },
        }),
      },
    });

    await expect(
      createDeliveredRevision(db, {
        termLearningModuleId: "tlm-1",
        expectedDeliveredLearningModuleVersionId: "lmv-older",
        draft: { title: "Delivered revision" },
      }),
    ).rejects.toThrow(ConcurrencyConflictError);
  });
});

describe("planned vs delivered diff", () => {
  it("derives added, changed, and reordered topic changes from the two snapshots", async () => {
    const db = createTransactionalDb({
      termLearningModule: {
        findUnique: async () => ({
          id: "tlm-1",
          learningModuleVersionId: "planned-v1",
          deliveredLearningModuleVersionId: "delivered-v2",
        }),
      },
      learningModuleVersionTopic: {
        findMany: async ({ where }: any) => {
          if (where.learningModuleVersionId === "planned-v1") {
            return [
              { topicVersionId: "tv-a1", sequence: 1, topicVersion: { topicId: "topic-a" } },
              { topicVersionId: "tv-b1", sequence: 2, topicVersion: { topicId: "topic-b" } },
            ];
          }
          return [
            { topicVersionId: "tv-a2", sequence: 1, topicVersion: { topicId: "topic-a" } },
            { topicVersionId: "tv-c1", sequence: 3, topicVersion: { topicId: "topic-c" } },
            { topicVersionId: "tv-b1", sequence: 4, topicVersion: { topicId: "topic-b" } },
          ];
        },
      },
    });

    const diff = await computePlannedDeliveredDiff(db, "tlm-1");

    expect(diff.topicChanges).toEqual([
      {
        topicId: "topic-a",
        kind: "changed",
        plannedTopicVersionId: "tv-a1",
        deliveredTopicVersionId: "tv-a2",
        plannedSequence: 1,
        deliveredSequence: 1,
      },
      {
        topicId: "topic-c",
        kind: "added",
        plannedTopicVersionId: null,
        deliveredTopicVersionId: "tv-c1",
        plannedSequence: null,
        deliveredSequence: 3,
      },
      {
        topicId: "topic-b",
        kind: "reordered",
        plannedTopicVersionId: "tv-b1",
        deliveredTopicVersionId: "tv-b1",
        plannedSequence: 2,
        deliveredSequence: 4,
      },
    ]);
  });
});

describe("term clone preview", () => {
  it("reports unresolved dates when the target term has fewer class meetings", async () => {
    const db = createTransactionalDb({
      term: {
        findUnique: async () => ({
          id: "term-1",
          courseId: "course-1",
          learningModules: [{ id: "tlm-1" }],
          sessions: [
            {
              id: "session-1",
              date: new Date("2026-01-12"),
              sequence: 1,
              coverages: [],
              priorArt: [],
            },
            {
              id: "session-2",
              date: new Date("2026-01-14"),
              sequence: 2,
              coverages: [],
              priorArt: [],
            },
          ],
          assessments: [],
          calendarSlots: [
            { date: new Date("2026-01-12"), slotType: "class_day" },
            { date: new Date("2026-01-14"), slotType: "class_day" },
          ],
        }),
      },
      courseInstitution: {
        findUnique: async () => ({ courseId: "course-1", institutionId: "institution-1" }),
      },
      academicCalendar: {
        findUnique: async () => ({ id: "calendar-1" }),
      },
      academicCalendarEvent: {
        findMany: async () => [],
      },
    });

    const preview = await previewTermClone(db, {
      sourceTermId: "term-1",
      code: "F26",
      name: "Fall 2026",
      institutionId: "institution-1",
      academicCalendarId: "calendar-1",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-02"),
      meetingPattern: { days: ["tuesday"] },
    });

    expect(preview.kind).toBe("preview");
    expect(preview.unresolvedDates).toHaveLength(1);
    expect(preview.warnings).toContain("Target Term has fewer class meetings than the source Term");
  });
});
