import { NotFoundError } from "@/services/redesign/errors";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  badRequest,
  conflict,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { meetingPlacementPreviewRequestSchema } from "@/lib/redesign-schemas";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
  previewMeetingPlacement,
} from "@/services/redesign";
import type {
  MeetingPlacementPreviewRequest,
  MeetingPlacementPreviewResponse,
} from "@/lib/redesign-contract";
export type { MeetingPlacementPreviewRequest, MeetingPlacementPreviewResponse };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const parsed = meetingPlacementPreviewRequestSchema.safeParse(
    await request.json(),
  );
  if (!parsed.success)
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  try {
    const result = await previewMeetingPlacement(prisma, {
      instructorId: instructor.id,
      termId: id,
      ...parsed.data,
    });
    return ok({
      ...result,
      placements: result.placements.map((p) => ({
        ...p,
        startsAt: p.startsAt.toISOString(),
        endsAt: p.endsAt?.toISOString() ?? null,
      })),
    } satisfies MeetingPlacementPreviewResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError)
      return conflict(error.message);
    if (error instanceof DomainInvariantError)
      return error instanceof NotFoundError ? notFound(error.message) : badRequest(error.message);
    throw error;
  }
}
