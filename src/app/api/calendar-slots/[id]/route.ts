import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, notFound, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toCalendarSlotDto } from "@/lib/redesign-serializers";
import { updateCalendarSlotCapacitySchema } from "@/lib/redesign-schemas";
import { DomainInvariantError, getOwnedCalendarSlotForInstructor } from "@/services/redesign";
import type { RedesignTx } from "@/services/redesign/types";
import type {
  UpdateCalendarSlotCapacityRequest,
  UpdateCalendarSlotCapacityResponse,
} from "@/lib/redesign-contract";

export type { UpdateCalendarSlotCapacityRequest, UpdateCalendarSlotCapacityResponse };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = updateCalendarSlotCapacitySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  let existing;
  try {
    existing = await prisma.$transaction((tx: RedesignTx) =>
      getOwnedCalendarSlotForInstructor(tx, instructor.id, id),
    );
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
  if (existing.term.status === "closed") {
    return badRequest("Closed Terms are read-only");
  }

  const calendarSlot = await prisma.calendarSlot.update({
    where: { id },
    data: {
      instructionalCapacity: parsed.data.instructionalCapacity,
      capacitySource: parsed.data.capacitySource,
      capacityReason: parsed.data.capacityReason ?? null,
    },
  });
  return ok({ calendarSlot: toCalendarSlotDto(calendarSlot) } satisfies UpdateCalendarSlotCapacityResponse);
}
