import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import {
  toAcademicCalendarEventDto,
  toAcademicCalendarPeriodDto,
  toAcademicCalendarVersionDto,
} from "@/lib/redesign-serializers";
import { DomainInvariantError, getAcademicCalendarVersionForInstructor } from "@/services/redesign";
import type { GetAcademicCalendarVersionResponse } from "@/lib/redesign-contract";

export type { GetAcademicCalendarVersionResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const { id } = await params;

  try {
    const result = await getAcademicCalendarVersionForInstructor(prisma, instructor.id, id);
    return ok({
      version: toAcademicCalendarVersionDto(result.version),
      events: result.events.map(toAcademicCalendarEventDto),
      periods: result.periods.map(toAcademicCalendarPeriodDto),
    } satisfies GetAcademicCalendarVersionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
