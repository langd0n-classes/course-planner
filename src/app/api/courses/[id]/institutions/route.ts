import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toInstitutionDto } from "@/lib/redesign-serializers";
import { replaceCourseInstitutionsSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  listCourseInstitutionsForInstructor,
  replaceCourseInstitutions,
} from "@/services/redesign";
import type {
  ListCourseInstitutionsResponse,
  ReplaceCourseInstitutionsRequest,
  ReplaceCourseInstitutionsResponse,
} from "@/lib/redesign-contract";

export type {
  ListCourseInstitutionsResponse,
  ReplaceCourseInstitutionsRequest,
  ReplaceCourseInstitutionsResponse,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const institutions = await listCourseInstitutionsForInstructor(prisma, instructor.id, id);
    return ok({ institutions: institutions.map(toInstitutionDto) } satisfies ListCourseInstitutionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Course not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = replaceCourseInstitutionsSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const courseInstitutions = await replaceCourseInstitutions(prisma, {
      instructorId: instructor.id,
      courseId: id,
      institutionIds: parsed.data.institutionIds,
    });
    return ok({
      courseInstitutions: courseInstitutions.map((row) => ({
        courseId: row.courseId,
        institutionId: row.institutionId,
      })),
    } satisfies ReplaceCourseInstitutionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Course not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
