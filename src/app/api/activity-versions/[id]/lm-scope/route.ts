import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityVersionLearningModuleScopeDto } from "@/lib/redesign-serializers";
import { replaceActivityLmScopeSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  listActivityLmScopeForInstructor,
  replaceActivityLmScopeForInstructor,
} from "@/services/redesign";
import type {
  ListActivityLmScopeResponse,
  ReplaceActivityLmScopeRequest,
  ReplaceActivityLmScopeResponse,
} from "@/lib/redesign-contract";

export type { ListActivityLmScopeResponse, ReplaceActivityLmScopeRequest, ReplaceActivityLmScopeResponse };

function mapDomainError(error: DomainInvariantError) {
  return error.message === "Activity version not found" || error.message === "Learning Module not found"
    ? notFound(error.message)
    : badRequest(error.message);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const scopes = await listActivityLmScopeForInstructor(prisma, instructor.id, id);
    return ok({
      scopes: scopes.map(toActivityVersionLearningModuleScopeDto),
    } satisfies ListActivityLmScopeResponse);
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
  const parsed = replaceActivityLmScopeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const scopes = await replaceActivityLmScopeForInstructor(prisma, {
      instructorId: instructor.id,
      activityVersionId: id,
      scopes: parsed.data.scopes,
    });
    return ok({
      scopes: scopes.map(toActivityVersionLearningModuleScopeDto),
    } satisfies ReplaceActivityLmScopeResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return mapDomainError(error);
    throw error;
  }
}
