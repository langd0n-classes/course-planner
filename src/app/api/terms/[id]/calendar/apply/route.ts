import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { termCalendarApplyRequestSchema } from "@/lib/redesign-schemas";
import { applyTermCalendar, ConcurrencyConflictError, DomainInvariantError } from "@/services/redesign";
import type { TermCalendarApplyRequest, TermCalendarApplyResponse } from "@/lib/redesign-contract";

export type { TermCalendarApplyRequest, TermCalendarApplyResponse };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const parsed = termCalendarApplyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const applied = await applyTermCalendar(prisma, {
      instructorId: instructor.id,
      termId: id,
      previewToken: parsed.data.previewToken,
      expectedCurrentCalendarSlotCount: parsed.data.expectedCurrentCalendarSlotCount,
      meetingPatterns: parsed.data.meetingPatterns,
    });
    return ok(applied satisfies TermCalendarApplyResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
