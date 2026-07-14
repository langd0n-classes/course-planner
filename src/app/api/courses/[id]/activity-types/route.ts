import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toCourseActivityTypeVersionDto } from "@/lib/redesign-serializers";
import { replaceCourseActivityTypeVersionsSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  listCourseActivityTypeVersions,
  replaceCourseActivityTypeVersions,
} from "@/services/redesign";
import type {
  ListCourseActivityTypeVersionsResponse,
  ReplaceCourseActivityTypeVersionsRequest,
  ReplaceCourseActivityTypeVersionsResponse,
} from "@/lib/redesign-contract";

export type {
  ListCourseActivityTypeVersionsResponse,
  ReplaceCourseActivityTypeVersionsRequest,
  ReplaceCourseActivityTypeVersionsResponse,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const activityTypeVersions = await listCourseActivityTypeVersions(prisma, instructor.id, id);
    return ok({
      activityTypeVersions: activityTypeVersions.map(toCourseActivityTypeVersionDto),
    } satisfies ListCourseActivityTypeVersionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = replaceCourseActivityTypeVersionsSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const activityTypeVersions = await replaceCourseActivityTypeVersions(prisma, {
      instructorId: instructor.id,
      courseId: id,
      activityTypeVersionIds: parsed.data.activityTypeVersionIds,
    });
    return ok({
      activityTypeVersions: activityTypeVersions.map(toCourseActivityTypeVersionDto),
    } satisfies ReplaceCourseActivityTypeVersionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Course not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
