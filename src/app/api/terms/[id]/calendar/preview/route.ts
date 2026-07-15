import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import {
  toCalendarMaterializationConflictDto,
  toCalendarSlotCandidateDto,
} from "@/lib/redesign-serializers";
import { termCalendarPreviewRequestSchema } from "@/lib/redesign-schemas";
import { DomainInvariantError, previewTermCalendar } from "@/services/redesign";
import type { TermCalendarPreviewRequest, TermCalendarPreviewResponse } from "@/lib/redesign-contract";

export type { TermCalendarPreviewRequest, TermCalendarPreviewResponse };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const parsed = termCalendarPreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const preview = await previewTermCalendar(prisma, {
      instructorId: instructor.id,
      termId: id,
      meetingPatterns: parsed.data.meetingPatterns,
    });
    return ok({
      kind: "preview",
      previewToken: preview.previewToken,
      expectedCurrentCalendarSlotCount: preview.expectedCurrentCalendarSlotCount,
      calendarSlotCandidates: preview.calendarSlotCandidates.map(toCalendarSlotCandidateDto),
      conflicts: preview.conflicts.map(toCalendarMaterializationConflictDto),
      warnings: preview.warnings,
    } satisfies TermCalendarPreviewResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
