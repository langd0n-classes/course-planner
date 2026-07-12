import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const db = prisma;

async function main() {
  console.log("Seeding redesign foundation data...");

  await db.$transaction(async (tx) => {
    await tx.artifact.deleteMany();
    await tx.assessmentTopic.deleteMany();
    await tx.coverage.deleteMany();
    await tx.assessment.deleteMany();
    await tx.sessionPriorArt.deleteMany();
    await tx.session.deleteMany();
    await tx.calendarSlot.deleteMany();
    await tx.termLearningModule.deleteMany();
    await tx.term.deleteMany();
    await tx.topicPrerequisite.deleteMany();
    await tx.learningModuleVersionTopic.deleteMany();
    await tx.topic.updateMany({ data: { currentVersionId: null } });
    await tx.learningModule.updateMany({ data: { currentVersionId: null } });
    await tx.topicVersion.deleteMany();
    await tx.learningModuleVersion.deleteMany();
    await tx.topic.deleteMany();
    await tx.learningModule.deleteMany();
    await tx.courseInstitution.deleteMany();
    await tx.course.deleteMany();
    await tx.instructorCalendarOverride.deleteMany();
    await tx.academicCalendarEvent.deleteMany();
    await tx.academicCalendar.deleteMany();
    await tx.instructorInstitution.deleteMany();
    await tx.institution.deleteMany();
    await tx.instructor.deleteMany();
  });

  const instructor = await db.instructor.create({
    data: {
      name: "Alice Chen",
      email: "alice.chen@example.edu",
    },
  });

  const institution = await db.institution.create({
    data: {
      name: "Example University",
      shortName: "EXU",
      canonicalUri: "https://example.edu",
      instructors: {
        create: {
          instructorId: instructor.id,
          status: "active",
          isDefault: true,
        },
      },
    },
  });

  const academicCalendar = await db.academicCalendar.create({
    data: {
      institutionId: institution.id,
      name: "Spring 2026",
      academicYear: "2025-2026",
      version: 1,
      sourceUri: "https://example.edu/calendars/spring-2026",
      publishedAt: new Date("2025-10-01T00:00:00Z"),
      events: {
        create: [
          {
            eventType: "term_start",
            startsOn: new Date("2026-01-20"),
            endsOn: new Date("2026-01-20"),
            label: "Spring term starts",
          },
          {
            eventType: "holiday",
            startsOn: new Date("2026-02-16"),
            endsOn: new Date("2026-02-16"),
            label: "Presidents' Day",
          },
        ],
      },
    },
    include: { events: true },
  });

  const serial = await db.instructor.update({
    where: { id: instructor.id },
    data: { nextCourseSerial: { increment: 1 } },
    select: { nextCourseSerial: true },
  });

  const course = await db.course.create({
    data: {
      instructorId: instructor.id,
      shortId: (serial.nextCourseSerial - 1).toString().padStart(3, "0"),
      title: "Data Science Foundations",
      number: "DS 1XX",
      numberIsPlaceholder: true,
      description: "Seeded redesign course used by Phase A tests.",
      institutions: {
        create: { institutionId: institution.id },
      },
    },
  });

  const lm = await db.learningModule.create({
    data: {
      courseId: course.id,
      stableCode: "LM-PROB",
    },
  });

  const topic = await db.topic.create({
    data: {
      courseId: course.id,
      learningModuleId: lm.id,
      stableCode: "TOPIC-PROB-1",
    },
  });

  const unassignedTopic = await db.topic.create({
    data: {
      courseId: course.id,
      learningModuleId: null,
      stableCode: "TOPIC-BACKLOG-1",
    },
  });

  const topicVersion = await db.topicVersion.create({
    data: {
      topicId: topic.id,
      revision: 1,
      title: "Probability 1",
      category: "Uncertainty",
      description: "Use probability language for uncertain events.",
      createdByInstructorId: instructor.id,
      publishedAt: new Date("2025-12-01T00:00:00Z"),
    },
  });
  await db.topic.update({
    where: { id: topic.id },
    data: { currentVersionId: topicVersion.id },
  });

  const unassignedTopicVersion = await db.topicVersion.create({
    data: {
      topicId: unassignedTopic.id,
      revision: 1,
      title: "Backlog Topic",
      category: "Unassigned",
      description: "Seeded topic with nullable learningModuleId.",
      createdByInstructorId: instructor.id,
    },
  });
  await db.topic.update({
    where: { id: unassignedTopic.id },
    data: { currentVersionId: unassignedTopicVersion.id },
  });

  const plannedVersion = await db.learningModuleVersion.create({
    data: {
      learningModuleId: lm.id,
      revision: 1,
      title: "Probability Foundations",
      description: "Initial planned probability module.",
      studentDescription: "You will reason about uncertainty.",
      learningObjectives: ["Describe random events", "Apply simple probability rules"],
      notes: "Planned at term start.",
      defaultSequence: 1,
      changeSummary: "Initial seed version",
      createdByInstructorId: instructor.id,
      publishedAt: new Date("2025-12-01T00:00:00Z"),
      topics: {
        create: {
          topicVersionId: topicVersion.id,
          sequence: 1,
        },
      },
    },
  });

  const deliveredVersion = await db.learningModuleVersion.create({
    data: {
      learningModuleId: lm.id,
      revision: 2,
      title: "Probability Foundations",
      description: "Delivered version after adding more simulation framing.",
      studentDescription: "You will reason about uncertainty using simulation.",
      learningObjectives: [
        "Describe random events",
        "Apply simple probability rules",
        "Connect probability to simulation",
      ],
      notes: "Delivered pointer seed round-trip.",
      defaultSequence: 1,
      changeSummary: "Added simulation emphasis during delivery",
      createdByInstructorId: instructor.id,
      publishedAt: new Date("2026-02-01T00:00:00Z"),
      topics: {
        create: {
          topicVersionId: topicVersion.id,
          sequence: 1,
        },
      },
    },
  });

  await db.learningModule.update({
    where: { id: lm.id },
    data: { currentVersionId: deliveredVersion.id },
  });

  // Path A: create the Term first, then create its TermLearningModule as a
  // second operation. TermLearningModule's compound FK to Term is
  // [termId, courseId] -> [id, courseId]; nesting the create under
  // Term.create fails because Prisma cannot resolve courseId for the
  // compound relation before the parent Term row exists. Creating the Term
  // and the TermLearningModule in separate calls (same instructorId/courseId
  // already known) avoids the nested-write ordering problem without
  // simplifying the compound keys.
  const term = await db.term.create({
    data: {
      courseId: course.id,
      institutionId: institution.id,
      academicCalendarId: academicCalendar.id,
      code: "S26",
      name: "Spring 2026",
      startDate: new Date("2026-01-20"),
      endDate: new Date("2026-05-08"),
      status: "active",
      meetingPattern: {
        days: ["tuesday", "thursday"],
        lectureTime: "14:00-15:15",
      },
      calendarSlots: {
        create: [
          {
            date: new Date("2026-01-20"),
            slotType: "class_day",
            label: "First class",
            academicCalendarEventId: academicCalendar.events[0].id,
            source: "seed",
            instructionalCapacity: "normal",
            capacitySource: "baseline",
          },
          {
            date: new Date("2026-02-12"),
            slotType: "class_day",
            label: "Class before Presidents' Day weekend",
            source: "seed",
            instructionalCapacity: "reduced_engagement",
            capacitySource: "heuristic",
            capacityReason: "Long weekend before the holiday reduces attendance.",
          },
          {
            date: new Date("2026-02-16"),
            slotType: "holiday",
            label: "Presidents' Day",
            academicCalendarEventId: academicCalendar.events[1].id,
            source: "seed",
          },
          {
            date: new Date("2026-01-22"),
            slotType: "class_day",
            label: "Recovery day",
            source: "seed",
            instructionalCapacity: "recovery",
            capacitySource: "instructor_override",
            capacityReason: "Instructor flagged this session to recover lost time.",
          },
        ],
      },
    },
  });

  const termLearningModule = await db.termLearningModule.create({
    data: {
      termId: term.id,
      learningModuleId: lm.id,
      learningModuleVersionId: plannedVersion.id,
      deliveredLearningModuleVersionId: deliveredVersion.id,
      courseId: course.id,
      sequence: 1,
      notes: "Planned and delivered pins intentionally differ.",
    },
  });

  const session = await db.session.create({
    data: {
      termId: term.id,
      termLearningModuleId: termLearningModule.id,
      sequence: 1,
      sessionType: "lecture",
      code: "lec-01",
      title: "Probability Foundations",
      date: new Date("2026-01-20"),
      instructionalMode: "standard",
      coverages: {
        create: {
          topicVersionId: topicVersion.id,
          level: "introduced",
        },
      },
    },
  });

  await db.session.create({
    data: {
      termId: term.id,
      termLearningModuleId: termLearningModule.id,
      sequence: 2,
      sessionType: "lecture",
      code: "lec-02",
      title: "Recovery: Probability Foundations continued",
      date: new Date("2026-01-22"),
      instructionalMode: "recovery",
    },
  });

  await db.assessment.create({
    data: {
      termId: term.id,
      sessionId: session.id,
      code: "quiz-01",
      title: "Probability Check",
      assessmentType: "assignment",
      dueDate: new Date("2026-01-27"),
      topics: {
        create: {
          topicVersionId: topicVersion.id,
        },
      },
    },
  });

  await db.artifact.create({
    data: {
      parentType: "learning_module_version",
      learningModuleVersionId: plannedVersion.id,
      artifactType: "slides",
      sourceType: "external_uri",
      title: "Probability intro deck",
      uri: "https://docs.example.edu/probability-intro",
      mimeType: "text/html",
    },
  });

  console.log("Seeded redesign foundation data:");
  console.log(`- Course ${course.shortId}: ${course.title}`);
  console.log(`- Planned LM version: ${plannedVersion.id}`);
  console.log(`- Delivered LM version: ${deliveredVersion.id}`);
  console.log(`- Unassigned topic: ${unassignedTopic.stableCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
