import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toCourseDto } from "@/lib/redesign-serializers";
import { updateCourseSchema } from "@/lib/redesign-schemas";
import { DomainInvariantError, getOwnedCourse, updateCourse } from "@/services/redesign";
import type {
  GetCourseResponse,
  UpdateCourseRequest,
  UpdateCourseResponse,
} from "@/lib/redesign-contract";

export type { GetCourseResponse, UpdateCourseRequest, UpdateCourseResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const course = await getOwnedCourse(prisma, instructor.id, id);
    return ok({ course: toCourseDto(course) } satisfies GetCourseResponse);
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
  const parsed = updateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const course = await updateCourse(prisma, instructor.id, id, {
      title: parsed.data.title,
      titleIsPlaceholder: parsed.data.titleIsPlaceholder,
      number: parsed.data.number,
      numberIsPlaceholder: parsed.data.numberIsPlaceholder,
      description: parsed.data.description,
      archivedAt:
        parsed.data.archivedAt === undefined
          ? undefined
          : parsed.data.archivedAt === null
            ? null
            : new Date(parsed.data.archivedAt),
    });
    return ok({ course: toCourseDto(course) } satisfies UpdateCourseResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Course not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
