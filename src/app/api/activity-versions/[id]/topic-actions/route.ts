import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityVersionTopicActionWithSiblingsDto } from "@/lib/redesign-serializers";
import { replaceActivityTopicActionsSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  listActivityTopicActionsForInstructor,
  replaceActivityTopicActionsForInstructor,
} from "@/services/redesign";
import type {
  ListActivityTopicActionsResponse,
  ReplaceActivityTopicActionsRequest,
  ReplaceActivityTopicActionsResponse,
} from "@/lib/redesign-contract";

export type {
  ListActivityTopicActionsResponse,
  ReplaceActivityTopicActionsRequest,
  ReplaceActivityTopicActionsResponse,
};

function mapDomainError(error: DomainInvariantError) {
  return error.message === "Activity version not found" || error.message === "Topic version not found"
    ? notFound(error.message)
    : badRequest(error.message);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const topicActions = await listActivityTopicActionsForInstructor(prisma, instructor.id, id);
    return ok({
      topicActions: topicActions.map(toActivityVersionTopicActionWithSiblingsDto),
    } satisfies ListActivityTopicActionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return mapDomainError(error);
    throw error;
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = replaceActivityTopicActionsSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const topicActions = await replaceActivityTopicActionsForInstructor(prisma, {
      instructorId: instructor.id,
      activityVersionId: id,
      actions: parsed.data.actions,
    });
    return ok({
      topicActions: topicActions.map(toActivityVersionTopicActionWithSiblingsDto),
    } satisfies ReplaceActivityTopicActionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return mapDomainError(error);
    throw error;
  }
}
