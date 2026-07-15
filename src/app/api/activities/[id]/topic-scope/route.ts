import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityTopicScopeDto } from "@/lib/redesign-serializers";
import { replaceActivityTopicScopeSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  listActivityTopicScopeForInstructor,
  replaceActivityTopicScopeForInstructor,
} from "@/services/redesign";
import type {
  ListActivityTopicScopeResponse,
  ReplaceActivityTopicScopeRequest,
  ReplaceActivityTopicScopeResponse,
} from "@/lib/redesign-contract";

export type {
  ListActivityTopicScopeResponse,
  ReplaceActivityTopicScopeRequest,
  ReplaceActivityTopicScopeResponse,
};

function mapDomainError(error: DomainInvariantError) {
  return error.message === "Activity not found" || error.message === "Topic not found"
    ? notFound(error.message)
    : badRequest(error.message);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const scopes = await listActivityTopicScopeForInstructor(prisma, instructor.id, id);
    return ok({
      scopes: scopes.map(toActivityTopicScopeDto),
    } satisfies ListActivityTopicScopeResponse);
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
  const parsed = replaceActivityTopicScopeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const scopes = await replaceActivityTopicScopeForInstructor(prisma, {
      instructorId: instructor.id,
      activityId: id,
      scopes: parsed.data.scopes,
    });
    return ok({
      scopes: scopes.map(toActivityTopicScopeDto),
    } satisfies ReplaceActivityTopicScopeResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return mapDomainError(error);
    throw error;
  }
}
