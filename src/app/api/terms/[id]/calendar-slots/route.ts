import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok } from "@/lib/api-helpers";
import { toCalendarSlotDto } from "@/lib/redesign-serializers";
import type { ListCalendarSlotsResponse } from "@/lib/redesign-contract";

export type { ListCalendarSlotsResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const calendarSlots = await prisma.calendarSlot.findMany({
    where: { termId: id },
    orderBy: { date: "asc" },
  });
  return ok({ calendarSlots: calendarSlots.map(toCalendarSlotDto) } satisfies ListCalendarSlotsResponse);
}
