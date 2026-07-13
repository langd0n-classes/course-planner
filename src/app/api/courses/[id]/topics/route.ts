import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized, forbidden } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTopicDto, toTopicVersionDto } from "@/lib/redesign-serializers";
import { createTopicSchema } from "@/lib/redesign-schemas";
import {
  createTopic,
  DomainInvariantError,
  getOwnedCourse,
  listTopicsForCourse,
} from "@/services/redesign";
import type { CreateTopicRequest, CreateTopicResponse, ListTopicsResponse } from "@/lib/redesign-contract";

export type { CreateTopicRequest, CreateTopicResponse, ListTopicsResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const topics = await listTopicsForCourse(prisma, instructor.id, id);
    return ok({ topics: topics.map(toTopicDto) } satisfies ListTopicsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = createTopicSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }
  if (parsed.data.createdByInstructorId !== instructor.id) {
    return forbidden("Cannot create a Topic for another Instructor");
  }

  try {
    await getOwnedCourse(prisma, instructor.id, id);
    const createdTopic = await createTopic(prisma, {
      courseId: id,
      stableCode: parsed.data.stableCode,
      learningModuleId: parsed.data.learningModuleId,
      createdByInstructorId: instructor.id,
      draft: {
        title: parsed.data.version.title,
        category: parsed.data.version.category,
        description: parsed.data.version.description,
        changeSummary: parsed.data.version.changeSummary,
      },
    });
    return created({
      topic: toTopicDto(createdTopic.topic),
      currentVersion: toTopicVersionDto(createdTopic.currentVersion),
    } satisfies CreateTopicResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Course not found" ? notFound(error.message) : badRequest(error.message);
    }
    if (error instanceof Error) return badRequest(error.message);
    throw error;
  }
}
