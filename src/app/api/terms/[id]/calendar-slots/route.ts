import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toCalendarSlotDto } from "@/lib/redesign-serializers";
import { DomainInvariantError, getOwnedTermForInstructor } from "@/services/redesign";
import type { RedesignTx } from "@/services/redesign/types";
import type { ListCalendarSlotsResponse } from "@/lib/redesign-contract";

export type { ListCalendarSlotsResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    await prisma.$transaction((tx: RedesignTx) => getOwnedTermForInstructor(tx, instructor.id, id));
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }

  const calendarSlots = await prisma.calendarSlot.findMany({
    where: { termId: id },
    orderBy: { date: "asc" },
  });
  return ok({ calendarSlots: calendarSlots.map(toCalendarSlotDto) } satisfies ListCalendarSlotsResponse);
}
