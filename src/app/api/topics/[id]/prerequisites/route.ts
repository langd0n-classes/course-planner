import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTopicPrerequisiteDto } from "@/lib/redesign-serializers";
import { replaceTopicPrerequisitesSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  listTopicPrerequisitesForInstructor,
  replaceTopicPrerequisitesForInstructor,
} from "@/services/redesign";
import type {
  ListTopicPrerequisitesResponse,
  ReplaceTopicPrerequisitesRequest,
  ReplaceTopicPrerequisitesResponse,
} from "@/lib/redesign-contract";

export type {
  ListTopicPrerequisitesResponse,
  ReplaceTopicPrerequisitesRequest,
  ReplaceTopicPrerequisitesResponse,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const prerequisites = await listTopicPrerequisitesForInstructor(prisma, instructor.id, id);
    return ok({
      prerequisites: prerequisites.map(toTopicPrerequisiteDto),
    } satisfies ListTopicPrerequisitesResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Topic not found" || error.message === "Course not found"
        ? notFound(error.message)
        : badRequest(error.message);
    }
    throw error;
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = replaceTopicPrerequisitesSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const prerequisites = await replaceTopicPrerequisitesForInstructor(prisma, {
      instructorId: instructor.id,
      topicId: id,
      prerequisiteTopicIds: parsed.data.prerequisiteTopicIds,
    });
    return ok({
      prerequisites: prerequisites.map(toTopicPrerequisiteDto),
    } satisfies ReplaceTopicPrerequisitesResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Topic not found" || error.message === "Course not found"
        ? notFound(error.message)
        : badRequest(error.message);
    }
    throw error;
  }
}
