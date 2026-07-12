import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, notFound } from "@/lib/api-helpers";
import { toCalendarSlotDto } from "@/lib/redesign-serializers";
import { updateCalendarSlotCapacitySchema } from "@/lib/redesign-schemas";
import type {
  UpdateCalendarSlotCapacityRequest,
  UpdateCalendarSlotCapacityResponse,
} from "@/lib/redesign-contract";

export type { UpdateCalendarSlotCapacityRequest, UpdateCalendarSlotCapacityResponse };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateCalendarSlotCapacitySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.calendarSlot.findUnique({
    where: { id },
    include: { term: { select: { status: true } } },
  });
  if (!existing) return notFound("Calendar slot not found");
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
