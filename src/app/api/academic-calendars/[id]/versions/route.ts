import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import {
  toAcademicCalendarEventDto,
  toAcademicCalendarPeriodDto,
  toAcademicCalendarVersionDto,
} from "@/lib/redesign-serializers";
import { createAcademicCalendarVersionSchema } from "@/lib/redesign-schemas";
import {
  createAcademicCalendarVersion,
  DomainInvariantError,
  listAcademicCalendarVersionsForInstructor,
} from "@/services/redesign";
import type {
  CreateAcademicCalendarVersionRequest,
  CreateAcademicCalendarVersionResponse,
  ListAcademicCalendarVersionsResponse,
} from "@/lib/redesign-contract";

export type {
  CreateAcademicCalendarVersionRequest,
  CreateAcademicCalendarVersionResponse,
  ListAcademicCalendarVersionsResponse,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const { id } = await params;

  try {
    const versions = await listAcademicCalendarVersionsForInstructor(prisma, instructor.id, id);
    return ok({
      versions: versions.map(toAcademicCalendarVersionDto),
    } satisfies ListAcademicCalendarVersionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const parsed = createAcademicCalendarVersionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await createAcademicCalendarVersion(prisma, {
      instructorId: instructor.id,
      academicCalendarId: id,
      name: parsed.data.name,
      academicYear: parsed.data.academicYear,
      sourceUri: parsed.data.sourceUri,
      events: parsed.data.events?.map((event) => ({
        eventType: event.eventType,
        startsOn: new Date(`${event.startsOn}T00:00:00.000Z`),
        endsOn: new Date(`${event.endsOn}T00:00:00.000Z`),
        label: event.label,
        sourceUri: event.sourceUri,
      })),
      periods: parsed.data.periods?.map((period) => ({
        kind: period.kind,
        label: period.label,
        startsOn: new Date(`${period.startsOn}T00:00:00.000Z`),
        endsOn: new Date(`${period.endsOn}T00:00:00.000Z`),
      })),
    });
    return created({
      version: toAcademicCalendarVersionDto(result.version),
      events: result.events.map(toAcademicCalendarEventDto),
      periods: result.periods.map(toAcademicCalendarPeriodDto),
    } satisfies CreateAcademicCalendarVersionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Academic Calendar not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
