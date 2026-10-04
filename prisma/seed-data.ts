import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  ExemplarImportService,
  genericDemoExemplarSnapshot,
} from "../src/services/redesign/exemplar-import-service";

// These IDs are reserved for the default demo. A natural-key conflict with a
// user row fails the seed instead of adopting or changing that row.
export function seedId(key: string): string {
  const hex = createHash("sha256")
    .update(`course-planner/default-seed/v1/${key}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Insert missing demo rows and set version pointers only on seed-owned rows. */
export async function seedDemoRows(
  db: PrismaClient,
  options: { instructorEmail?: string; instructorName?: string } = {},
): Promise<void> {
  const id = seedId;
  const instructorEmail = options.instructorEmail?.trim() || "instructor-a";
  const instructorName = options.instructorName?.trim() || "Instructor A";
  const instructor = await db.instructor.upsert({
    where: { id: id("instructor") },
    create: {
      id: id("instructor"),
      email: instructorEmail,
      name: instructorName,
      nextCourseSerial: 3,
    },
    update: {},
  });
  if (instructor.email !== instructorEmail) {
    throw new Error(
      "Seed instructor already exists with a different email; use --force only if a full wipe is intended",
    );
  }
  const institution = await db.institution.upsert({
    where: { id: id("institution") },
    create: {
      id: id("institution"),
      name: "Example University",
      shortName: "EXU",
      canonicalUri: "https://example.edu",
    },
    update: {},
  });
  await db.instructorInstitution.upsert({
    where: {
      instructorId_institutionId: {
        instructorId: instructor.id,
        institutionId: institution.id,
      },
    },
    create: {
      instructorId: instructor.id,
      institutionId: institution.id,
      status: "active",
      isDefault: true,
    },
    update: {},
  });
  const calendar = await db.academicCalendar.upsert({
    where: { id: id("calendar") },
    create: {
      id: id("calendar"),
      institutionId: institution.id,
      name: "Spring 2026",
      academicYear: "2025-2026",
      version: 1,
      sourceUri: "https://example.edu/calendars/spring-2026",
      publishedAt: new Date("2025-10-01T00:00:00Z"),
    },
    update: {},
  });
  const startEvent = await db.academicCalendarEvent.upsert({
    where: { id: id("calendar-event-start") },
    create: {
      id: id("calendar-event-start"),
      academicCalendarId: calendar.id,
      eventType: "term_start",
      startsOn: new Date("2026-01-20"),
      endsOn: new Date("2026-01-20"),
      label: "Spring term starts",
    },
    update: {},
  });
  const holidayEvent = await db.academicCalendarEvent.upsert({
    where: { id: id("calendar-event-holiday") },
    create: {
      id: id("calendar-event-holiday"),
      academicCalendarId: calendar.id,
      eventType: "holiday",
      startsOn: new Date("2026-02-16"),
      endsOn: new Date("2026-02-16"),
      label: "Presidents' Day",
    },
    update: {},
  });
  await db.instructorCalendarOverride.upsert({
    where: { id: id("calendar-override") },
    create: {
      id: id("calendar-override"),
      instructorId: instructor.id,
      academicCalendarId: calendar.id,
      action: "add",
      eventType: "holiday",
      startsOn: new Date("2026-03-05"),
      endsOn: new Date("2026-03-05"),
      label: "Department symposium",
      reason: "Generic seeded instructor override example.",
    },
    update: {},
  });
  const course = await db.course.upsert({
    where: { id: id("foundation-course") },
    create: {
      id: id("foundation-course"),
      instructorId: instructor.id,
      shortId: "001",
      title: "Data Science Foundations",
      number: "DS 1XX",
      numberIsPlaceholder: true,
      description: "Seeded redesign course used by Phase A tests.",
    },
    update: {},
  });
  await db.courseInstitution.upsert({
    where: {
      courseId_institutionId: {
        courseId: course.id,
        institutionId: institution.id,
      },
    },
    create: { courseId: course.id, institutionId: institution.id },
    update: {},
  });
  const lm = await db.learningModule.upsert({
    where: { id: id("learning-module") },
    create: {
      id: id("learning-module"),
      courseId: course.id,
      stableCode: "LM-PROB",
    },
    update: {},
  });
  const topic = await db.topic.upsert({
    where: { id: id("topic-prob") },
    create: {
      id: id("topic-prob"),
      courseId: course.id,
      stableCode: "TOPIC-PROB-1",
    },
    update: {},
  });
  const backlogTopic = await db.topic.upsert({
    where: { id: id("topic-backlog") },
    create: {
      id: id("topic-backlog"),
      courseId: course.id,
      stableCode: "TOPIC-BACKLOG-1",
    },
    update: {},
  });
  const topicVersion = await db.topicVersion.upsert({
    where: { id: id("topic-prob-version") },
    create: {
      id: id("topic-prob-version"),
      topicId: topic.id,
      revision: 1,
      title: "Probability 1",
      category: "Uncertainty",
      description: "Use probability language for uncertain events.",
      createdByInstructorId: instructor.id,
      publishedAt: new Date("2025-12-01T00:00:00Z"),
    },
    update: {},
  });
  await db.topicVersion.upsert({
    where: { id: id("topic-backlog-version") },
    create: {
      id: id("topic-backlog-version"),
      topicId: backlogTopic.id,
      revision: 1,
      title: "Backlog Topic",
      category: "Unassigned",
      description: "Seeded topic with nullable learningModuleId.",
      createdByInstructorId: instructor.id,
    },
    update: {},
  });
  // Pointers are set only on first creation. Later instructor edits are preserved.
  if (!topic.currentVersionId)
    await db.topic.update({
      where: { id: topic.id },
      data: { currentVersionId: topicVersion.id },
    });
  if (!backlogTopic.currentVersionId)
    await db.topic.update({
      where: { id: backlogTopic.id },
      data: { currentVersionId: id("topic-backlog-version") },
    });
  const planned = await db.learningModuleVersion.upsert({
    where: { id: id("lm-planned") },
    create: {
      id: id("lm-planned"),
      learningModuleId: lm.id,
      revision: 1,
      title: "Probability Foundations",
      description: "Initial planned probability module.",
      studentDescription: "You will reason about uncertainty.",
      learningObjectives: [
        "Describe random events",
        "Apply simple probability rules",
      ],
      notes: "Planned at term start.",
      defaultSequence: 1,
      changeSummary: "Initial seed version",
      createdByInstructorId: instructor.id,
      publishedAt: new Date("2025-12-01T00:00:00Z"),
    },
    update: {},
  });
  const delivered = await db.learningModuleVersion.upsert({
    where: { id: id("lm-delivered") },
    create: {
      id: id("lm-delivered"),
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
    },
    update: {},
  });
  for (const version of [planned, delivered]) {
    await db.learningModuleVersionTopic.upsert({
      where: {
        learningModuleVersionId_topicVersionId: {
          learningModuleVersionId: version.id,
          topicVersionId: topicVersion.id,
        },
      },
      create: {
        learningModuleVersionId: version.id,
        topicVersionId: topicVersion.id,
        sequence: 1,
      },
      update: {},
    });
  }
  if (!lm.currentVersionId)
    await db.learningModule.update({
      where: { id: lm.id },
      data: { currentVersionId: delivered.id },
    });
  const term = await db.term.upsert({
    where: { id: id("term") },
    create: {
      id: id("term"),
      courseId: course.id,
      institutionId: institution.id,
      academicCalendarId: calendar.id,
      code: "S26",
      name: "Spring 2026",
      startDate: new Date("2026-01-20"),
      endDate: new Date("2026-05-08"),
      status: "active",
      meetingPattern: {
        roles: [
          {
            roleKey: "lecture",
            label: "Lecture",
            sessionType: "lecture",
            days: ["tuesday", "thursday"],
          },
        ],
      },
    },
    update: {},
  });
  const slotData = [
    {
      key: "first",
      date: "2026-01-20",
      label: "First class",
      slotType: "class_day" as const,
      academicCalendarEventId: startEvent.id,
      source: "meeting_roles:lecture",
      instructionalCapacity: "normal" as const,
      capacitySource: "baseline" as const,
    },
    {
      key: "recovery",
      date: "2026-01-22",
      label: "Recovery day",
      slotType: "class_day" as const,
      source: "meeting_roles:lecture",
      instructionalCapacity: "recovery" as const,
      capacitySource: "instructor_override" as const,
      capacityReason: "Instructor flagged this session to recover lost time.",
    },
    {
      key: "long-weekend",
      date: "2026-02-12",
      label: "Class before Presidents' Day weekend",
      slotType: "class_day" as const,
      source: "meeting_roles:lecture",
      instructionalCapacity: "reduced_engagement" as const,
      capacitySource: "heuristic" as const,
      capacityReason: "Long weekend before the holiday reduces attendance.",
    },
    {
      key: "holiday",
      date: "2026-02-16",
      label: "Presidents' Day",
      slotType: "holiday" as const,
      academicCalendarEventId: holidayEvent.id,
      source: "academic_calendar_event",
    },
  ];
  for (const slot of slotData) {
    const { key, date, ...data } = slot;
    await db.calendarSlot.upsert({
      where: { id: id(`slot-${key}`) },
      create: {
        id: id(`slot-${key}`),
        termId: term.id,
        date: new Date(date),
        ...data,
      },
      update: {},
    });
  }
  const termLm = await db.termLearningModule.upsert({
    where: { id: id("term-learning-module") },
    create: {
      id: id("term-learning-module"),
      termId: term.id,
      learningModuleId: lm.id,
      learningModuleVersionId: planned.id,
      deliveredLearningModuleVersionId: delivered.id,
      courseId: course.id,
      sequence: 1,
      notes: "Planned and delivered pins intentionally differ.",
    },
    update: {},
  });
  const sessions = [
    {
      key: "session-1",
      sequence: 1,
      code: "lec-01",
      title: "Probability Foundations",
      date: "2026-01-20",
      calendarSlotId: id("slot-first"),
      instructionalMode: "standard" as const,
    },
    {
      key: "session-2",
      sequence: 2,
      code: "lec-02",
      title: "Recovery: Probability Foundations continued",
      date: "2026-01-22",
      calendarSlotId: id("slot-recovery"),
      instructionalMode: "recovery" as const,
    },
    {
      key: "session-3",
      sequence: 3,
      code: "lec-03",
      title: "Explicit override example",
      date: "2026-01-23",
      scheduleOverrideLabel: "Friday make-up workshop",
      instructionalMode: "other" as const,
      notes: "Seeded explicit override evidence example.",
    },
  ];
  for (const session of sessions) {
    const { key, date, ...data } = session;
    await db.session.upsert({
      where: { id: id(key) },
      create: {
        id: id(key),
        termId: term.id,
        termLearningModuleId: termLm.id,
        sessionType: "lecture",
        date: new Date(date),
        ...data,
      },
      update: {},
    });
  }
  await db.coverage.upsert({
    where: { id: id("coverage") },
    create: {
      id: id("coverage"),
      sessionId: id("session-1"),
      topicVersionId: topicVersion.id,
      level: "introduced",
    },
    update: {},
  });
  const assessment = await db.assessment.upsert({
    where: { id: id("assessment") },
    create: {
      id: id("assessment"),
      termId: term.id,
      sessionId: id("session-1"),
      code: "quiz-01",
      title: "Probability Check",
      assessmentType: "assignment",
      dueDate: new Date("2026-01-27"),
    },
    update: {},
  });
  await db.assessmentTopic.upsert({
    where: {
      assessmentId_topicVersionId: {
        assessmentId: assessment.id,
        topicVersionId: topicVersion.id,
      },
    },
    create: { assessmentId: assessment.id, topicVersionId: topicVersion.id },
    update: {},
  });
  await db.artifact.upsert({
    where: { id: id("artifact") },
    create: {
      id: id("artifact"),
      parentType: "learning_module_version",
      learningModuleVersionId: planned.id,
      artifactType: "slides",
      sourceType: "external_uri",
      title: "Probability intro deck",
      uri: "https://docs.example.edu/probability-intro",
      mimeType: "text/html",
    },
    update: {},
  });
  const exemplarId = id("exemplar-course");
  const exemplarExists = await db.course.findUnique({
    where: { id: exemplarId },
    select: { id: true },
  });
  const exemplarCourse = await db.course.upsert({
    where: { id: exemplarId },
    create: {
      id: exemplarId,
      instructorId: instructor.id,
      shortId: "002",
      title: "Intro Data Science",
      number: "IDS 101",
      description:
        "Generic demo course built through the exemplar importer seed path.",
    },
    update: {},
  });
  await db.courseInstitution.upsert({
    where: {
      courseId_institutionId: {
        courseId: exemplarCourse.id,
        institutionId: institution.id,
      },
    },
    create: { courseId: exemplarCourse.id, institutionId: institution.id },
    update: {},
  });
  // The importer has natural stable keys and creates version rows once. Reapply
  // only when the seed course is new or an interrupted first run left it empty.
  const importedModules = await db.learningModule.count({
    where: { courseId: exemplarId },
  });
  if (!exemplarExists || importedModules === 0) {
    await new ExemplarImportService().apply(db, {
      instructorId: instructor.id,
      courseId: exemplarCourse.id,
      snapshot: genericDemoExemplarSnapshot,
    });
  }
}
