import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTermCalendarExceptionDto } from "@/lib/redesign-serializers";
import { updateTermCalendarExceptionSchema } from "@/lib/redesign-schemas";
import {
  deleteTermCalendarException,
  DomainInvariantError,
  updateTermCalendarException,
} from "@/services/redesign";
import type {
  UpdateTermCalendarExceptionRequest,
  UpdateTermCalendarExceptionResponse,
} from "@/lib/redesign-contract";

export type { UpdateTermCalendarExceptionRequest, UpdateTermCalendarExceptionResponse };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; exceptionId: string }> },
) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const { exceptionId } = await params;
  const body = await request.json();
  const parsed = updateTermCalendarExceptionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const exception = await updateTermCalendarException(prisma, exceptionId, instructor.id, {
      action: parsed.data.action,
      activityTypeVersionId: parsed.data.activityTypeVersionId,
      calendarSlotId: parsed.data.calendarSlotId,
      targetDate: parsed.data.targetDate ? new Date(`${parsed.data.targetDate}T00:00:00.000Z`) : undefined,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      label: parsed.data.label,
      reason: parsed.data.reason,
      provenance: parsed.data.provenance,
    });
    return ok({
      exception: toTermCalendarExceptionDto(exception),
    } satisfies UpdateTermCalendarExceptionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; exceptionId: string }> },
) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const { exceptionId } = await params;

  try {
    await deleteTermCalendarException(prisma, exceptionId, instructor.id);
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
