import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, forbidden, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityTypeDto, toActivityTypeVersionDto } from "@/lib/redesign-serializers";
import { createActivityTypeSchema } from "@/lib/redesign-schemas";
import {
  createActivityType,
  DomainInvariantError,
  listActivityTypesForInstructor,
} from "@/services/redesign";
import type {
  CreateActivityTypeRequest,
  CreateActivityTypeResponse,
  ListActivityTypesResponse,
} from "@/lib/redesign-contract";

export type { CreateActivityTypeRequest, CreateActivityTypeResponse, ListActivityTypesResponse };

export async function GET() {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const activityTypes = await listActivityTypesForInstructor(prisma, instructor.id);
  return ok({
    activityTypes: activityTypes.map(toActivityTypeDto),
  } satisfies ListActivityTypesResponse);
}

export async function POST(request: NextRequest) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = createActivityTypeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }
  if (parsed.data.createdByInstructorId !== instructor.id) {
    return forbidden("Cannot create an Activity Type for another Instructor");
  }

  try {
    const activityType = await createActivityType(prisma, {
      instructorId: instructor.id,
      behaviorFamily: parsed.data.behaviorFamily,
      createdByInstructorId: instructor.id,
      publish: parsed.data.version.publish,
      draft: {
        label: parsed.data.version.label,
        description: parsed.data.version.description,
        changeSummary: parsed.data.version.changeSummary,
      },
    });

    return created({
      activityType: toActivityTypeDto(activityType),
      currentVersion: toActivityTypeVersionDto(activityType.currentVersion),
    } satisfies CreateActivityTypeResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
