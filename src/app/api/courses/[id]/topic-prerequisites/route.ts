import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTopicPrerequisiteDto } from "@/lib/redesign-serializers";
import type { ListCourseTopicPrerequisitesResponse } from "@/lib/redesign-contract";

export type { ListCourseTopicPrerequisitesResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const course = await prisma.course.findUnique({
    where: { id_instructorId: { id, instructorId: instructor.id } },
    select: { id: true },
  });
  if (!course) return notFound("Course not found");

  const prerequisites = await prisma.topicPrerequisite.findMany({
    where: { courseId: id },
    orderBy: [{ topicId: "asc" }, { prerequisiteTopicId: "asc" }],
  });

  return ok({
    prerequisites: prerequisites.map(toTopicPrerequisiteDto),
  } satisfies ListCourseTopicPrerequisitesResponse);
}
