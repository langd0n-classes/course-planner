import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityTypeVersionDto } from "@/lib/redesign-serializers";
import { upsertActivityTypeVersionSchema } from "@/lib/redesign-schemas";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
  getActivityTypeForInstructor,
  listActivityTypeVersionsForInstructor,
  reviseActivityType,
} from "@/services/redesign";
import type {
  CreateActivityTypeVersionResponse,
  ListActivityTypeVersionsResponse,
  UpsertActivityTypeVersionRequest,
} from "@/lib/redesign-contract";

export type {
  CreateActivityTypeVersionResponse,
  ListActivityTypeVersionsResponse,
  UpsertActivityTypeVersionRequest,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const versions = await listActivityTypeVersionsForInstructor(prisma, instructor.id, id);
    return ok({
      versions: versions.map(toActivityTypeVersionDto),
    } satisfies ListActivityTypeVersionsResponse);
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
  const parsed = upsertActivityTypeVersionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const activityType = await getActivityTypeForInstructor(prisma, instructor.id, id);
    const expectedCurrentVersionId =
      parsed.data.expectedCurrentVersionId ?? activityType.activityType.currentVersionId;
    if (!expectedCurrentVersionId) {
      return badRequest("Activity Type current version is missing");
    }

    const version = await reviseActivityType(prisma, {
      activityTypeId: id,
      instructorId: instructor.id,
      expectedCurrentVersionId,
      createdByInstructorId: instructor.id,
      publish: parsed.data.publish,
      draft: {
        label: parsed.data.label,
        description: parsed.data.description,
        changeSummary: parsed.data.changeSummary,
      },
    });

    return created({
      version: toActivityTypeVersionDto(version),
    } satisfies CreateActivityTypeVersionResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    if (error instanceof DomainInvariantError) {
      return error.message === "Activity Type not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
