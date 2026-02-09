import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, notFound, serverError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: termId } = await params;

  try {
    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term) return notFound("Term not found");

    const slots = await prisma.calendarSlot.findMany({
      where: { termId },
      orderBy: { date: "asc" },
    });

    return ok(slots);
  } catch (error) {
    console.error("Calendar slots error:", error);
    return serverError("Failed to fetch calendar slots");
  }
}
