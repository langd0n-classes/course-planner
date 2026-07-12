import { DomainInvariantError } from "./errors";
import { assertAcyclicTopicPrerequisite, assertSameCourse } from "./invariants";
import type { RedesignDb } from "./types";

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
