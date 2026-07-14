import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityTypeDto, toActivityTypeVersionDto } from "@/lib/redesign-serializers";
import { updateActivityTypeSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  getActivityTypeForInstructor,
  updateActivityType,
} from "@/services/redesign";
import type {
  GetActivityTypeResponse,
  UpdateActivityTypeRequest,
  UpdateActivityTypeResponse,
} from "@/lib/redesign-contract";

export type { GetActivityTypeResponse, UpdateActivityTypeRequest, UpdateActivityTypeResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const detail = await getActivityTypeForInstructor(prisma, instructor.id, id);
    return ok({
      activityType: toActivityTypeDto(detail.activityType),
      currentVersion: detail.currentVersion ? toActivityTypeVersionDto(detail.currentVersion) : null,
    } satisfies GetActivityTypeResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = updateActivityTypeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    await updateActivityType(prisma, instructor.id, id, {
      archivedAt: parsed.data.archivedAt === null ? null : new Date(parsed.data.archivedAt),
    });
    const detail = await getActivityTypeForInstructor(prisma, instructor.id, id);
    return ok({
      activityType: toActivityTypeDto(detail.activityType),
      currentVersion: detail.currentVersion ? toActivityTypeVersionDto(detail.currentVersion) : null,
    } satisfies UpdateActivityTypeResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Activity Type not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
