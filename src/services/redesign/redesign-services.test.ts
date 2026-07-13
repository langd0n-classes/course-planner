/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import {
  hardRemoveTopic,
  previewHardRemoval,
  setArchivedState,
} from "./archive-removal-service";
import { createArtifact } from "./artifact-service";
import { previewCalendarMaterialization } from "./calendar-materialization-service";
import { applyTermClone, previewTermClone } from "./clone-service";
import { createCourse } from "./course-service";
import { ConcurrencyConflictError, DomainInvariantError, ImmutablePublishedVersionError } from "./errors";
import { assertAcyclicTopicPrerequisite, assertSameCourse } from "./invariants";
import { transitionTermLifecycle } from "./lifecycle-service";
import { computePlannedDeliveredDiff, createDeliveredRevision } from "./offering-service";
import {
  assertPublishedLearningModuleVersionImmutable,
  reviseLearningModule,
  updateTopic,
} from "./revision-service";
import { applyTermCreation, createTerm } from "./term-service";

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
        findUnique: async () => ({
          id: "term-1",
          status: "planned",
          closedAt: null,
          course: { instructorId: "instructor-1" },
        }),
        updateMany: async ({ where }: any) => {
          updateWhere = where;
          return { count: 1 };
        },
      },
    });

    const term = await transitionTermLifecycle(db, {
      instructorId: "instructor-1",
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
        findUnique: async () => ({
          id: "term-1",
          status: "planned",
          closedAt: null,
          course: { instructorId: "instructor-1" },
        }),
        updateMany: async () => ({ count: 0 }),
      },
    });

    await expect(
      transitionTermLifecycle(db, {
        instructorId: "instructor-1",
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
        instructorId: "instructor-1",
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
        instructorId: "instructor-1",
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
      topicVersion: {
        findUnique: async () => ({
          id: "topic-version-1",
          topic: { course: { instructorId: "instructor-1" } },
        }),
      },
    });

    await expect(
      createArtifact(db, {
        instructorId: "instructor-1",
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
      topicVersion: {
        findUnique: async () => ({
          id: "topic-version-1",
          topic: { course: { instructorId: "instructor-1" } },
        }),
      },
    });

    await expect(
      createArtifact(db, {
        instructorId: "instructor-1",
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
      instructorInstitution: {
        findUnique: async () => ({ status: "active" }),
      },
      courseInstitution: {
        findMany: async () => [],
        findUnique: async () => null,
      },
      academicCalendar: {
        findUnique: async () => ({ id: "calendar-1", institutionId: "institution-1" }),
      },
    });

    await expect(
      createTerm(db, {
        instructorId: "instructor-1",
        courseId: "course-1",
        institutionId: "institution-1",
        academicCalendarId: "calendar-1",
        code: "S26",
        name: "Spring 2026",
        startDate: new Date("2026-01-20"),
        endDate: new Date("2026-05-08"),
        meetingPattern: {
          roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["tuesday"] }],
        },
      }),
    ).rejects.toThrow("Term Institution must be valid for the Course");
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
        findMany: async () => [{ institutionId: "institution-1" }],
        findUnique: async () => ({ courseId: "course-1", institutionId: "institution-1" }),
      },
      academicCalendar: {
        findUnique: async () => null,
      },
    });

    await expect(
      createTerm(db, {
        instructorId: "instructor-1",
        courseId: "course-1",
        institutionId: "institution-1",
        academicCalendarId: "calendar-other",
        code: "S26",
        name: "Spring 2026",
        startDate: new Date("2026-01-20"),
        endDate: new Date("2026-05-08"),
        meetingPattern: {
          roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["tuesday"] }],
        },
      }),
    ).rejects.toThrow("Academic Calendar must belong");
  });

  it("previews calendar slot materialization before apply", async () => {
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
        findMany: async () => [{ institutionId: "institution-1" }],
        findUnique: async () => ({ courseId: "course-1", institutionId: "institution-1" }),
      },
      academicCalendar: {
        findUnique: async () => ({ id: "calendar-1", institutionId: "institution-1" }),
      },
      academicCalendarEvent: {
        findMany: async ({ where }: any) => {
          if (where.eventType?.in) {
            return [
              { id: "event-start", eventType: "term_start", startsOn: new Date("2026-01-20"), endsOn: new Date("2026-01-20"), label: "Start" },
              { id: "event-end", eventType: "term_end", startsOn: new Date("2026-05-08"), endsOn: new Date("2026-05-08"), label: "End" },
            ];
          }
          return [
            { id: "event-holiday", eventType: "holiday", startsOn: new Date("2026-02-16"), endsOn: new Date("2026-02-16"), label: "Holiday" },
          ];
        },
      },
      instructorCalendarOverride: {
        findMany: async () => [
          {
            id: "override-1",
            action: "add",
            eventType: "holiday",
            startsOn: new Date("2026-03-05"),
            endsOn: new Date("2026-03-05"),
            label: "Symposium",
            reason: "Department symposium",
            academicCalendarEventId: null,
          },
        ],
      },
    });

    const preview = await import("./term-service").then(({ previewTermCreation }) =>
      previewTermCreation(db, {
        instructorId: "instructor-1",
        courseId: "course-1",
        institutionId: "institution-1",
        academicCalendarId: "calendar-1",
        code: "S26",
        name: "Spring 2026",
        startDate: new Date("2026-01-20"),
        endDate: new Date("2026-03-10"),
        meetingPattern: {
          roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["tuesday", "thursday"] }],
        },
      }),
    );

    expect(preview.kind).toBe("preview");
    expect(preview.calendarSlotCandidates.some((slot) => slot.slotType === "holiday")).toBe(true);
    expect(preview.calendarSlotCandidates.some((slot) => slot.slotType === "class_day")).toBe(true);
  });

  it("derives generic pre-break and post-break capacity hints from explicit break days", async () => {
    const preview = await previewCalendarMaterialization(
      {
        academicCalendarEvent: {
          findMany: async ({ where }: any) => {
            if (where.eventType?.in) {
              return [
                {
                  id: "event-start",
                  eventType: "term_start",
                  startsOn: new Date("2027-03-08"),
                  endsOn: new Date("2027-03-08"),
                  label: "Start",
                },
                {
                  id: "event-end",
                  eventType: "term_end",
                  startsOn: new Date("2027-03-26"),
                  endsOn: new Date("2027-03-26"),
                  label: "End",
                },
              ];
            }
            return [
              {
                id: "event-break",
                eventType: "break_day",
                startsOn: new Date("2027-03-15"),
                endsOn: new Date("2027-03-19"),
                label: "Mid-term break",
              },
            ];
          },
        },
        instructorCalendarOverride: {
          findMany: async () => [],
        },
      } as any,
      {
        instructorId: "instructor-1",
        academicCalendarId: "calendar-1",
        startDate: new Date("2027-03-08"),
        endDate: new Date("2027-03-26"),
        meetingPattern: {
          roles: [
            { roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["monday", "wednesday", "friday"] },
          ],
        },
      },
    );

    const preBreak = preview.candidates.find((slot) => slot.slotType === "class_day" && slot.date.toISOString().slice(0, 10) === "2027-03-12");
    const recovery = preview.candidates.find((slot) => slot.slotType === "class_day" && slot.date.toISOString().slice(0, 10) === "2027-03-22");
    const negativeControl = preview.candidates.find((slot) => slot.slotType === "class_day" && slot.date.toISOString().slice(0, 10) === "2027-03-24");

    expect(preBreak).toMatchObject({
      instructionalCapacity: "reduced_engagement",
      capacitySource: "heuristic",
      capacityReason: "Last class day before explicit break starting 2027-03-15.",
    });
    expect(recovery).toMatchObject({
      instructionalCapacity: "recovery",
      capacitySource: "heuristic",
      capacityReason: "First class day after explicit break ending 2027-03-19.",
    });
    expect(negativeControl).toMatchObject({
      instructionalCapacity: "normal",
      capacitySource: "baseline",
      capacityReason: "No explicit break-proximity signal in the calendar.",
    });
  });

  it("does not infer break-proximity hints from a holiday-only calendar event", async () => {
    const preview = await previewCalendarMaterialization(
      {
        academicCalendarEvent: {
          findMany: async ({ where }: any) => {
            if (where.eventType?.in) {
              return [
                {
                  id: "event-start",
                  eventType: "term_start",
                  startsOn: new Date("2027-02-08"),
                  endsOn: new Date("2027-02-08"),
                  label: "Start",
                },
                {
                  id: "event-end",
                  eventType: "term_end",
                  startsOn: new Date("2027-02-19"),
                  endsOn: new Date("2027-02-19"),
                  label: "End",
                },
              ];
            }
            return [
              {
                id: "event-holiday",
                eventType: "holiday",
                startsOn: new Date("2027-02-15"),
                endsOn: new Date("2027-02-15"),
                label: "Holiday",
              },
            ];
          },
        },
        instructorCalendarOverride: {
          findMany: async () => [],
        },
      } as any,
      {
        instructorId: "instructor-1",
        academicCalendarId: "calendar-1",
        startDate: new Date("2027-02-08"),
        endDate: new Date("2027-02-19"),
        meetingPattern: {
          roles: [
            { roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["monday", "wednesday", "friday"] },
          ],
        },
      },
    );

    const beforeHoliday = preview.candidates.find((slot) => slot.slotType === "class_day" && slot.date.toISOString().slice(0, 10) === "2027-02-12");
    const afterHoliday = preview.candidates.find((slot) => slot.slotType === "class_day" && slot.date.toISOString().slice(0, 10) === "2027-02-17");

    expect(beforeHoliday).toMatchObject({
      instructionalCapacity: "normal",
      capacitySource: "baseline",
      capacityReason: "No explicit break-proximity signal in the calendar.",
    });
    expect(afterHoliday).toMatchObject({
      instructionalCapacity: "normal",
      capacitySource: "baseline",
      capacityReason: "No explicit break-proximity signal in the calendar.",
    });
  });

  it("persists derived capacity hints when materializing calendar slots on apply", async () => {
    const createdSlots: any[] = [];
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
        findMany: async () => [{ courseId: "course-1", institutionId: "institution-1" }],
        findUnique: async () => ({ courseId: "course-1", institutionId: "institution-1" }),
      },
      academicCalendar: {
        findUnique: async () => ({ id: "calendar-1", institutionId: "institution-1" }),
      },
      academicCalendarEvent: {
        findMany: async ({ where }: any) => {
          if (where.eventType?.in) {
            return [
              { id: "event-start", eventType: "term_start", startsOn: new Date("2027-11-22"), endsOn: new Date("2027-11-22"), label: "Start" },
              { id: "event-end", eventType: "term_end", startsOn: new Date("2027-11-30"), endsOn: new Date("2027-11-30"), label: "End" },
            ];
          }
          return [
            {
              id: "event-break",
              eventType: "break_day",
              startsOn: new Date("2027-11-25"),
              endsOn: new Date("2027-11-26"),
              label: "Late-week break",
            },
          ];
        },
      },
      instructorCalendarOverride: {
        findMany: async () => [],
      },
      term: {
        create: async ({ data }: any) => ({ id: "term-1", ...data, status: "planned", closedAt: null, archivedAt: null }),
      },
      calendarSlot: {
        create: async ({ data }: any) => {
          createdSlots.push(data);
          return { id: `slot-${createdSlots.length}`, ...data };
        },
      },
    });

    await applyTermCreation(db, {
      instructorId: "instructor-1",
      courseId: "course-1",
      institutionId: "institution-1",
      academicCalendarId: "calendar-1",
      code: "F27",
      name: "Autumn 2027",
      startDate: new Date("2027-11-22"),
      endDate: new Date("2027-11-30"),
      meetingPattern: {
        roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["monday", "wednesday"] }],
      },
    });

    expect(
      createdSlots.find((slot) => slot.date.toISOString().slice(0, 10) === "2027-11-24"),
    ).toMatchObject({
      instructionalCapacity: "reduced_engagement",
      capacitySource: "heuristic",
      capacityReason: "Last class day before explicit break starting 2027-11-25.",
    });
    expect(
      createdSlots.find((slot) => slot.date.toISOString().slice(0, 10) === "2027-11-29"),
    ).toMatchObject({
      instructionalCapacity: "recovery",
      capacitySource: "heuristic",
      capacityReason: "First class day after explicit break ending 2027-11-26.",
    });
  });
});

describe("topic ownership invariants", () => {
  it("rejects moving a Topic across Course boundaries", async () => {
    const db = createTransactionalDb({
      course: {
        findUnique: async ({ where }: any) => {
          if (where.id_instructorId?.id === "course-1" && where.id_instructorId?.instructorId === "instructor-1") {
            return { id: "course-1", instructorId: "instructor-1" };
          }
          return null;
        },
      },
      topic: {
        findUnique: async () => ({
          id: "topic-1",
          courseId: "course-1",
          stableCode: "TOPIC-1",
          learningModuleId: "lm-1",
        }),
        update: async ({ data }: any) => ({ id: "topic-1", courseId: "course-1", ...data }),
      },
      learningModule: {
        findUnique: async () => ({ id: "lm-2", courseId: "course-2" }),
      },
    });

    await expect(
      updateTopic(db, "instructor-1", "topic-1", { learningModuleId: "lm-2" }),
    ).rejects.toThrow("cannot cross Course boundaries");
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
          term: { status: "active", course: { instructorId: "instructor-1" } },
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
      instructorId: "instructor-1",
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
          term: { status: "active", course: { instructorId: "instructor-1" } },
        }),
      },
    });

    await expect(
      createDeliveredRevision(db, {
        instructorId: "instructor-1",
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
          term: { course: { instructorId: "instructor-1" } },
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

    const diff = await computePlannedDeliveredDiff(db, "instructor-1", "tlm-1");

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
          course: { instructorId: "instructor-1" },
          meetingPattern: {
            roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["monday", "wednesday"] }],
          },
          learningModules: [{ id: "tlm-1" }],
          sessions: [
            {
              id: "session-1",
              date: new Date("2026-01-12"),
              sessionType: "lecture",
              sequence: 1,
              coverages: [],
              priorArt: [],
            },
            {
              id: "session-2",
              date: new Date("2026-01-14"),
              sessionType: "lecture",
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
      instructorCalendarOverride: {
        findMany: async () => [],
      },
    });

    const preview = await previewTermClone(db, {
      instructorId: "instructor-1",
      sourceTermId: "term-1",
      code: "F26",
      name: "Fall 2026",
      institutionId: "institution-1",
      academicCalendarId: "calendar-1",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-02"),
      meetingPattern: {
        roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["tuesday"] }],
      },
    });

    expect(preview.kind).toBe("preview");
    expect(preview.unresolvedDates).toHaveLength(1);
    expect(preview.warnings).toContain("Target Term has fewer lecture meetings than the source Term");
  });

  it("applies cross-season clones by leaving unresolved sessions in the unscheduled pool", async () => {
    const createdSlots: any[] = [];
    const createdLearningModules: any[] = [];
    const createdSessions: any[] = [];
    const createdPriorArt: any[] = [];
    const createdCoverages: any[] = [];

    const db = createTransactionalDb({
      term: {
        findUnique: async ({ where }: any) => {
          if (where.id !== "term-1") return null;
          return {
            id: "term-1",
            courseId: "course-1",
            course: { instructorId: "instructor-1" },
            meetingPattern: {
              roles: [
                { roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["monday"] },
                { roleKey: "lab", label: "Lab", sessionType: "lab", days: ["wednesday"] },
              ],
            },
            learningModules: [
              {
                id: "tlm-source-1",
                learningModuleId: "lm-1",
                learningModuleVersionId: "planned-v1",
                deliveredLearningModuleVersionId: "delivered-v2",
                sequence: 1,
                notes: "Source note",
              },
            ],
            sessions: [
              {
                id: "session-1",
                termLearningModuleId: "tlm-source-1",
                sequence: 1,
                sessionType: "lecture",
                code: "L01",
                title: "Mapped lecture",
                date: new Date("2026-11-23"),
                scheduleOverrideLabel: null,
                description: null,
                format: null,
                notes: null,
                status: "scheduled",
                instructionalMode: "standard",
                canceledAt: null,
                canceledReason: null,
                archivedAt: null,
                coverages: [{ topicVersionId: "tv-1", level: "introduced", notes: null, redistributedFrom: null, redistributedAt: null }],
                priorArt: [{ sourceSessionId: "session-older", note: "Earlier delivery evidence" }],
              },
              {
                id: "session-2",
                termLearningModuleId: "tlm-source-1",
                sequence: 2,
                sessionType: "lecture",
                code: "L02",
                title: "Unresolved lecture",
                date: new Date("2026-11-30"),
                scheduleOverrideLabel: "Reading-room swap",
                description: null,
                format: null,
                notes: null,
                status: "scheduled",
                instructionalMode: "standard",
                canceledAt: null,
                canceledReason: null,
                archivedAt: null,
                coverages: [{ topicVersionId: "tv-2", level: "practiced", notes: null, redistributedFrom: "coverage-src", redistributedAt: new Date("2026-11-30T12:00:00Z") }],
                priorArt: [],
              },
              {
                id: "session-3",
                termLearningModuleId: "tlm-source-1",
                sequence: 3,
                sessionType: "lab",
                code: "B01",
                title: "Mapped lab",
                date: new Date("2026-11-25"),
                scheduleOverrideLabel: null,
                description: null,
                format: null,
                notes: null,
                status: "scheduled",
                instructionalMode: "standard",
                canceledAt: null,
                canceledReason: null,
                archivedAt: null,
                coverages: [],
                priorArt: [],
              },
            ],
            assessments: [],
            calendarSlots: [
              { date: new Date("2026-11-23"), slotType: "class_day" },
              { date: new Date("2026-11-25"), slotType: "class_day" },
              { date: new Date("2026-11-30"), slotType: "class_day" },
            ],
          };
        },
        create: async ({ data }: any) => ({ id: "term-2", ...data, status: "planned", closedAt: null, archivedAt: null }),
      },
      courseInstitution: {
        findUnique: async () => ({ courseId: "course-1", institutionId: "institution-2" }),
      },
      academicCalendar: {
        findUnique: async () => ({ id: "calendar-2", institutionId: "institution-2" }),
      },
      academicCalendarEvent: {
        findMany: async ({ where }: any) => {
          if (where.eventType?.in) {
            return [
              { id: "event-start", eventType: "term_start", startsOn: new Date("2027-01-18"), endsOn: new Date("2027-01-18"), label: "Start" },
              { id: "event-end", eventType: "term_end", startsOn: new Date("2027-01-22"), endsOn: new Date("2027-01-22"), label: "End" },
            ];
          }
          return [];
        },
      },
      instructorCalendarOverride: {
        findMany: async () => [],
      },
      calendarSlot: {
        create: async ({ data }: any) => {
          const created = { id: `slot-${createdSlots.length + 1}`, ...data };
          createdSlots.push(created);
          return created;
        },
      },
      termLearningModule: {
        create: async ({ data }: any) => {
          const created = { id: `tlm-created-${createdLearningModules.length + 1}`, ...data };
          createdLearningModules.push(created);
          return created;
        },
      },
      session: {
        create: async ({ data }: any) => {
          const created = { id: `session-created-${createdSessions.length + 1}`, ...data };
          createdSessions.push(created);
          return created;
        },
      },
      sessionPriorArt: {
        create: async ({ data }: any) => {
          createdPriorArt.push(data);
          return data;
        },
      },
      coverage: {
        create: async ({ data }: any) => {
          createdCoverages.push(data);
          return data;
        },
      },
      assessment: {
        create: async ({ data }: any) => ({ id: "assessment-1", ...data }),
      },
    });

    const applied = await applyTermClone(db, {
      instructorId: "instructor-1",
      sourceTermId: "term-1",
      code: "SP27",
      name: "Spring 2027",
      institutionId: "institution-2",
      academicCalendarId: "calendar-2",
      startDate: new Date("2027-01-18"),
      endDate: new Date("2027-01-22"),
      meetingPattern: {
        roles: [
          { roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["tuesday"] },
          { roleKey: "lab", label: "Lab", sessionType: "lab", days: ["thursday"] },
        ],
      },
    });

    expect(applied.kind).toBe("applied");
    expect(createdLearningModules).toEqual([
      expect.objectContaining({
        learningModuleVersionId: "delivered-v2",
        deliveredLearningModuleVersionId: null,
      }),
    ]);
    expect(createdSessions.map((session) => ({
      code: session.code,
      date: session.date ? session.date.toISOString().slice(0, 10) : null,
      calendarSlotId: session.calendarSlotId,
    }))).toEqual([
      { code: "L01", date: "2027-01-19", calendarSlotId: "slot-1" },
      { code: "L02", date: null, calendarSlotId: null },
      { code: "B01", date: "2027-01-21", calendarSlotId: "slot-2" },
    ]);
    const unresolvedSourceLink = createdPriorArt.find(
      (row) => row.sessionId === "session-created-2" && row.sourceSessionId === "session-2",
    );
    expect(unresolvedSourceLink?.note).toContain("Source override: Reading-room swap.");
    expect(unresolvedSourceLink?.note).toContain(
      "Cloned without a target class-day slot: Target Term has fewer lecture meetings than the source Term.",
    );
    expect(
      createdPriorArt.some(
        (row) => row.sessionId === "session-created-1" && row.sourceSessionId === "session-older",
      ),
    ).toBe(true);
    expect(createdCoverages).toEqual([
      expect.objectContaining({
        sessionId: "session-created-1",
        topicVersionId: "tv-1",
        redistributedFrom: null,
      }),
      expect.objectContaining({
        sessionId: "session-created-2",
        topicVersionId: "tv-2",
        redistributedFrom: "coverage-src",
      }),
    ]);
  });

  it("still blocks clone apply when materialization conflicts remain", async () => {
    const db = createTransactionalDb({
      term: {
        findUnique: async () => ({
          id: "term-1",
          courseId: "course-1",
          course: { instructorId: "instructor-1" },
          meetingPattern: {
            roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["monday"] }],
          },
          learningModules: [],
          sessions: [
            {
              id: "session-1",
              termLearningModuleId: null,
              sequence: 1,
              sessionType: "lecture",
              code: "L01",
              title: "Lecture",
              date: new Date("2026-09-07"),
              scheduleOverrideLabel: null,
              description: null,
              format: null,
              notes: null,
              status: "scheduled",
              instructionalMode: "standard",
              canceledAt: null,
              canceledReason: null,
              archivedAt: null,
              coverages: [],
              priorArt: [],
            },
          ],
          assessments: [],
          calendarSlots: [{ date: new Date("2026-09-07"), slotType: "class_day" }],
        }),
      },
      courseInstitution: {
        findUnique: async () => ({ courseId: "course-1", institutionId: "institution-1" }),
      },
      academicCalendar: {
        findUnique: async () => ({ id: "calendar-1" }),
      },
      academicCalendarEvent: {
        findMany: async ({ where }: any) => {
          if (where.eventType?.in) {
            return [
              { id: "event-start", eventType: "term_start", startsOn: new Date("2027-01-18"), endsOn: new Date("2027-01-18"), label: "Start" },
              { id: "event-end", eventType: "term_end", startsOn: new Date("2027-01-22"), endsOn: new Date("2027-01-22"), label: "End" },
            ];
          }
          return [
            {
              id: "event-break",
              eventType: "break_day",
              startsOn: new Date("2027-01-19"),
              endsOn: new Date("2027-01-19"),
              label: "Blocked day",
            },
          ];
        },
      },
      instructorCalendarOverride: {
        findMany: async () => [],
      },
    });

    await expect(
      applyTermClone(db, {
        instructorId: "instructor-1",
        sourceTermId: "term-1",
        code: "SP27",
        name: "Spring 2027",
        institutionId: "institution-1",
        academicCalendarId: "calendar-1",
        startDate: new Date("2027-01-18"),
        endDate: new Date("2027-01-22"),
        meetingPattern: {
          roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["tuesday"] }],
        },
      }),
    ).rejects.toThrow("materialization conflicts");
  });
});
