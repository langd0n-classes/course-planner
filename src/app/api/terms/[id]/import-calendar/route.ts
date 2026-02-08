import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { importCalendarSchema } from "@/lib/schemas";
import { ok, badRequest, notFound, handleZodError, serverError } from "@/lib/api-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: termId } = await params;

  try {
    const body = await request.json();
    const parsed = importCalendarSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    // Verify term exists and get date range
    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term) return notFound("Term not found");

    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);

    // Validate all dates fall within term range
    const outOfRange: string[] = [];
    for (const slot of parsed.data.slots) {
      const d = new Date(slot.date);
      if (isNaN(d.getTime())) {
        return badRequest(`Invalid date: ${slot.date}`);
      }
      if (d < termStart || d > termEnd) {
        outOfRange.push(slot.date);
      }
    }
    if (outOfRange.length > 0) {
      return badRequest(
        `Dates out of term range (${term.startDate.toISOString().slice(0, 10)} to ${term.endDate.toISOString().slice(0, 10)}): ${outOfRange.join(", ")}`,
      );
    }

    // Upsert calendar slots
    let created = 0;
    let updated = 0;

    for (const slot of parsed.data.slots) {
      const date = new Date(slot.date);
      const existing = await prisma.calendarSlot.findUnique({
        where: { termId_date: { termId, date } },
      });

      if (existing) {
        await prisma.calendarSlot.update({
          where: { id: existing.id },
          data: {
            dayOfWeek: slot.dayOfWeek,
            slotType: slot.slotType,
            label: slot.label ?? null,
          },
        });
        updated++;
      } else {
        await prisma.calendarSlot.create({
          data: {
            termId,
            date,
            dayOfWeek: slot.dayOfWeek,
            slotType: slot.slotType,
            label: slot.label ?? null,
          },
        });
        created++;
      }
    }

    return ok({ created, updated, total: created + updated });
  } catch (error) {
    console.error("Calendar import error:", error);
    return serverError("Failed to import calendar");
  }
}
