import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTopicVersionDto } from "@/lib/redesign-serializers";
import type { GetTopicVersionResponse } from "@/lib/redesign-contract";

export type { GetTopicVersionResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const version = await prisma.topicVersion.findUnique({
    where: { id },
    include: { topic: { select: { courseId: true } } },
  });
  if (!version) return notFound("Topic version not found");

  const course = await prisma.course.findUnique({
    where: { id_instructorId: { id: version.topic.courseId, instructorId: instructor.id } },
    select: { id: true },
  });
  if (!course) return notFound("Topic version not found");

  return ok({ version: toTopicVersionDto(version) } satisfies GetTopicVersionResponse);
}
