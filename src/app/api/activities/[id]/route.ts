import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityDto, toActivityVersionDto } from "@/lib/redesign-serializers";
import { updateActivitySchema } from "@/lib/redesign-schemas";
import { DomainInvariantError, getActivityForInstructor, updateActivity } from "@/services/redesign";
import type { GetActivityResponse, UpdateActivityRequest, UpdateActivityResponse } from "@/lib/redesign-contract";

export type { GetActivityResponse, UpdateActivityRequest, UpdateActivityResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const detail = await getActivityForInstructor(prisma, instructor.id, id);
    return ok({
      activity: toActivityDto(detail.activity),
      currentVersion: detail.currentVersion ? toActivityVersionDto(detail.currentVersion) : null,
    } satisfies GetActivityResponse);
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
  const parsed = updateActivitySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    await updateActivity(prisma, instructor.id, id, {
      stableCode: parsed.data.stableCode,
      archivedAt:
        parsed.data.archivedAt === undefined
          ? undefined
          : parsed.data.archivedAt === null
            ? null
            : new Date(parsed.data.archivedAt),
    });
    const detail = await getActivityForInstructor(prisma, instructor.id, id);
    return ok({
      activity: toActivityDto(detail.activity),
      currentVersion: detail.currentVersion ? toActivityVersionDto(detail.currentVersion) : null,
    } satisfies UpdateActivityResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Activity not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
