import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, forbidden, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityDto, toActivityVersionDto } from "@/lib/redesign-serializers";
import { createActivitySchema } from "@/lib/redesign-schemas";
import { createActivity, DomainInvariantError, listActivitiesForCourse } from "@/services/redesign";
import type {
  CreateActivityRequest,
  CreateActivityResponse,
  ListActivitiesResponse,
} from "@/lib/redesign-contract";

export type { CreateActivityRequest, CreateActivityResponse, ListActivitiesResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const activities = await listActivitiesForCourse(prisma, instructor.id, id);
    return ok({ activities: activities.map(toActivityDto) } satisfies ListActivitiesResponse);
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
  const parsed = createActivitySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }
  if (parsed.data.createdByInstructorId !== instructor.id) {
    return forbidden("Cannot create an Activity for another Instructor");
  }

  try {
    const activity = await createActivity(prisma, {
      instructorId: instructor.id,
      courseId: id,
      stableCode: parsed.data.stableCode,
      createdByInstructorId: instructor.id,
      publish: parsed.data.version.publish,
      draft: {
        title: parsed.data.version.title,
        summary: parsed.data.version.summary,
        activityTypeVersionId: parsed.data.version.activityTypeVersionId,
        changeSummary: parsed.data.version.changeSummary,
        detail: parsed.data.version.detail,
        milestoneTemplates: parsed.data.version.milestoneTemplates,
      },
    });

    return created({
      activity: toActivityDto(activity),
      currentVersion: toActivityVersionDto(activity.currentVersion),
    } satisfies CreateActivityResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Course not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
