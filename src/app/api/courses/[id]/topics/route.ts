import { z as idSchema } from "zod";
import { unexpectedRouteError } from "@/lib/route-errors";
import { readJsonBody } from "@/lib/request-json";
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
  if (!idSchema.uuid().safeParse(id).success) return badRequest("Invalid id");
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const topics = await listTopicsForCourse(prisma, instructor.id, id);
    return ok({ topics: topics.map(toTopicDto) } satisfies ListTopicsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    return unexpectedRouteError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.uuid().safeParse(id).success) return badRequest("Invalid id");
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const json = await readJsonBody(request);
  if (json.response) return json.response;
  const body = json.data;
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
    return unexpectedRouteError(error);
  }
}
