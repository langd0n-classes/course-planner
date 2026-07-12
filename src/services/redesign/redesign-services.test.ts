/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import { createArtifact } from "./artifact-service";
import { createCourse } from "./course-service";
import { DomainInvariantError, ImmutablePublishedVersionError } from "./errors";
import { assertAcyclicTopicPrerequisite, assertSameCourse } from "./invariants";
import { assertPublishedLearningModuleVersionImmutable, reviseLearningModule } from "./revision-service";
import { createTerm } from "./term-service";

function createTransactionalDb(tx: Record<string, any>) {
  return {
    $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) => fn(tx),
  };
}

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
