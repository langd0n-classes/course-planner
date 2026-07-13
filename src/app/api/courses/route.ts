import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, ok, unauthorized, forbidden } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toCourseDto } from "@/lib/redesign-serializers";
import { createCourseSchema } from "@/lib/redesign-schemas";
import { createCourse, DomainInvariantError, listCoursesForInstructor } from "@/services/redesign";
import type { CreateCourseRequest, CreateCourseResponse, ListCoursesResponse } from "@/lib/redesign-contract";

export type { CreateCourseRequest, CreateCourseResponse, ListCoursesResponse };

export async function GET() {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const courses = await listCoursesForInstructor(prisma, instructor.id);
  return ok({ courses: courses.map(toCourseDto) } satisfies ListCoursesResponse);
}

export async function POST(request: NextRequest) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }
  if (parsed.data.instructorId !== instructor.id) {
    return forbidden("Cannot create a Course for another Instructor");
  }

  try {
    const course = await createCourse(prisma, {
      instructorId: instructor.id,
      title: parsed.data.title,
      titleIsPlaceholder: parsed.data.titleIsPlaceholder,
      number: parsed.data.number,
      numberIsPlaceholder: parsed.data.numberIsPlaceholder,
      description: parsed.data.description,
      institutionIds: parsed.data.institutionIds,
    });
    return created({ course: toCourseDto(course) } satisfies CreateCourseResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
