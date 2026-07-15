import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTermCalendarExceptionDto } from "@/lib/redesign-serializers";
import { createTermCalendarExceptionSchema } from "@/lib/redesign-schemas";
import {
  createTermCalendarException,
  DomainInvariantError,
  listTermCalendarExceptions,
} from "@/services/redesign";
import type {
  CreateTermCalendarExceptionRequest,
  CreateTermCalendarExceptionResponse,
  ListTermCalendarExceptionsResponse,
} from "@/lib/redesign-contract";

export type {
  CreateTermCalendarExceptionRequest,
  CreateTermCalendarExceptionResponse,
  ListTermCalendarExceptionsResponse,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const { id } = await params;
  try {
    const exceptions = await listTermCalendarExceptions(prisma, instructor.id, id);
    return ok({
      exceptions: exceptions.map(toTermCalendarExceptionDto),
    } satisfies ListTermCalendarExceptionsResponse);
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
  const parsed = createTermCalendarExceptionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const exception = await createTermCalendarException(prisma, id, {
      instructorId: instructor.id,
      action: parsed.data.action,
      activityTypeVersionId: parsed.data.activityTypeVersionId,
      calendarSlotId: parsed.data.calendarSlotId,
      targetDate: parsed.data.targetDate ? new Date(`${parsed.data.targetDate}T00:00:00.000Z`) : null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      label: parsed.data.label,
      reason: parsed.data.reason,
      provenance: parsed.data.provenance,
    });
    return created({
      exception: toTermCalendarExceptionDto(exception),
    } satisfies CreateTermCalendarExceptionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
