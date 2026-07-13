import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toAcademicCalendarDto } from "@/lib/redesign-serializers";
import { createAcademicCalendarSchema } from "@/lib/redesign-schemas";
import { createAcademicCalendar, DomainInvariantError, listAcademicCalendarsForInstructor } from "@/services/redesign";
import type {
  CreateAcademicCalendarRequest,
  CreateAcademicCalendarResponse,
  ListAcademicCalendarsResponse,
} from "@/lib/redesign-contract";

export type {
  CreateAcademicCalendarRequest,
  CreateAcademicCalendarResponse,
  ListAcademicCalendarsResponse,
};

export async function GET(request: NextRequest) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const institutionId = request.nextUrl.searchParams.get("institutionId");
  try {
    const academicCalendars = await listAcademicCalendarsForInstructor(
      prisma,
      instructor.id,
      institutionId,
    );
    return ok({
      academicCalendars: academicCalendars.map(toAcademicCalendarDto),
    } satisfies ListAcademicCalendarsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = createAcademicCalendarSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const academicCalendar = await createAcademicCalendar(prisma, {
      instructorId: instructor.id,
      institutionId: parsed.data.institutionId,
      name: parsed.data.name,
      academicYear: parsed.data.academicYear,
      sourceUri: parsed.data.sourceUri,
    });

    return created({
      academicCalendar: toAcademicCalendarDto(academicCalendar),
    } satisfies CreateAcademicCalendarResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Institution not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
