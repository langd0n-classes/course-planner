import { DomainInvariantError } from "./errors";
import { assertAcyclicTopicPrerequisite, assertSameCourse } from "./invariants";
import type { RedesignDb, RedesignTx } from "./types";

export async function listTopicPrerequisitesForInstructor(
  db: RedesignDb,
  instructorId: string,
  topicId: string,
) {
  return db.$transaction(async (tx) => {
    const topic = await tx.topic.findUnique({
      where: { id: topicId },
      select: { courseId: true },
    });
    if (!topic) throw new DomainInvariantError("Topic not found");
    await assertOwnedCourse(tx, instructorId, topic.courseId);
    return tx.topicPrerequisite.findMany({
      where: { topicId },
      orderBy: { prerequisiteTopicId: "asc" },
    });
  });
}

export async function addTopicPrerequisite(
  db: RedesignDb,
  input: { topicId: string; prerequisiteTopicId: string },
) {
  return db.$transaction(async (tx) => {
    const [topic, prerequisiteTopic] = await Promise.all([
      tx.topic.findUnique({ where: { id: input.topicId }, select: { id: true, courseId: true } }),
      tx.topic.findUnique({
        where: { id: input.prerequisiteTopicId },
        select: { id: true, courseId: true },
      }),
    ]);
    if (!topic || !prerequisiteTopic) {
      throw new DomainInvariantError("Topic or prerequisite Topic not found");
    }
    assertSameCourse(topic.courseId, prerequisiteTopic.courseId, "Topic prerequisites");

    const edges = await tx.topicPrerequisite.findMany({
      where: { courseId: topic.courseId },
      select: { topicId: true, prerequisiteTopicId: true },
    });
    assertAcyclicTopicPrerequisite(topic.id, prerequisiteTopic.id, edges);

    return tx.topicPrerequisite.create({
      data: {
        topicId: topic.id,
        prerequisiteTopicId: prerequisiteTopic.id,
        courseId: topic.courseId,
      },
    });
  });
}

export async function replaceTopicPrerequisitesForInstructor(
  db: RedesignDb,
  input: { instructorId: string; topicId: string; prerequisiteTopicIds: string[] },
) {
  return db.$transaction(async (tx) => {
    const topic = await tx.topic.findUnique({
      where: { id: input.topicId },
      select: { courseId: true },
    });
    if (!topic) throw new DomainInvariantError("Topic not found");
    await assertOwnedCourse(tx, input.instructorId, topic.courseId);

    const uniquePrerequisiteTopicIds = [...new Set(input.prerequisiteTopicIds)];
    const prerequisites = await tx.topic.findMany({
      where: {
        id: { in: uniquePrerequisiteTopicIds },
        courseId: topic.courseId,
      },
      select: { id: true },
    });
    if (prerequisites.length !== uniquePrerequisiteTopicIds.length) {
      throw new DomainInvariantError("Topic prerequisite must belong to the same Course");
    }

    const existingEdges = await tx.topicPrerequisite.findMany({
      where: { courseId: topic.courseId },
      select: { topicId: true, prerequisiteTopicId: true },
    });
    const proposedEdges = uniquePrerequisiteTopicIds.map((prerequisiteTopicId) => ({
      topicId: input.topicId,
      prerequisiteTopicId,
    }));
    const combinedEdges = [
      ...existingEdges.filter((edge) => edge.topicId !== input.topicId),
      ...proposedEdges,
    ];
    for (const prerequisiteTopicId of uniquePrerequisiteTopicIds) {
      assertAcyclicTopicPrerequisite(input.topicId, prerequisiteTopicId, combinedEdges);
    }

    await tx.topicPrerequisite.deleteMany({ where: { topicId: input.topicId } });
    if (uniquePrerequisiteTopicIds.length > 0) {
      await tx.topicPrerequisite.createMany({
        data: uniquePrerequisiteTopicIds.map((prerequisiteTopicId) => ({
          topicId: input.topicId,
          prerequisiteTopicId,
          courseId: topic.courseId,
        })),
      });
    }

    return tx.topicPrerequisite.findMany({
      where: { topicId: input.topicId },
      orderBy: { prerequisiteTopicId: "asc" },
    });
  });
}

async function assertOwnedCourse(tx: RedesignTx, instructorId: string, courseId: string) {
  const course = await tx.course.findUnique({
    where: { id_instructorId: { id: courseId, instructorId } },
  });
  if (!course) {
    throw new DomainInvariantError("Course not found");
  }
  return course;
}
