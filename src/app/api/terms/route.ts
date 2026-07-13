import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, created, badRequest } from "@/lib/api-helpers";
import { toTermDto } from "@/lib/redesign-serializers";
import { createTermSchema } from "@/lib/redesign-schemas";
import { DomainInvariantError } from "@/services/redesign";
import {
  applyTermCreation,
  previewTermCreation,
} from "@/services/redesign/term-service";
import type {
  CalendarSlotCandidateDto,
  CreateTermRequest,
  CreateTermResponse,
  ListTermsResponse,
} from "@/lib/redesign-contract";

export type { CreateTermRequest, CreateTermResponse, ListTermsResponse };

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get("courseId");
  const terms = await prisma.term.findMany({
    where: courseId ? { courseId } : undefined,
    orderBy: { startDate: "asc" },
  });
  return ok({ terms: terms.map(toTermDto) } satisfies ListTermsResponse);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createTermSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const input = {
      courseId: parsed.data.courseId,
      institutionId: parsed.data.institutionId,
      academicCalendarId: parsed.data.academicCalendarId,
      code: parsed.data.code,
      name: parsed.data.name,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      meetingPattern: parsed.data.meetingPattern,
    };

    if (parsed.data.mode === "preview") {
      const preview = await previewTermCreation(prisma, input);
      return ok({
        kind: "preview",
        calendarSlotCandidates: preview.calendarSlotCandidates.map(toCalendarSlotCandidateDto),
        conflicts: preview.conflicts,
        warnings: preview.warnings,
      } satisfies CreateTermResponse);
    }

    const applied = await applyTermCreation(prisma, input);
    return created({
      kind: "applied",
      term: toTermDto(applied.term),
      calendarSlotCount: applied.calendarSlotCount,
      warnings: applied.warnings,
    } satisfies CreateTermResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}

function toCalendarSlotCandidateDto(candidate: {
  date: Date;
  slotType: CalendarSlotCandidateDto["slotType"];
  label: string | null;
  source: string;
  academicCalendarEventId: string | null;
  meetingRoleKeys: string[];
  meetingRoleLabels: string[];
  provenance: CalendarSlotCandidateDto["provenance"];
}): CalendarSlotCandidateDto {
  return {
    date: candidate.date.toISOString().slice(0, 10),
    slotType: candidate.slotType,
    label: candidate.label,
    source: candidate.source,
    academicCalendarEventId: candidate.academicCalendarEventId,
    meetingRoleKeys: candidate.meetingRoleKeys,
    meetingRoleLabels: candidate.meetingRoleLabels,
    provenance: candidate.provenance,
  };
}
