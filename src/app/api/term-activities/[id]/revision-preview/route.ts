import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTermActivityRevisionDto } from "@/lib/redesign-serializers";
import { termActivityRevisionPreviewRequestSchema } from "@/lib/redesign-schemas";
import { DomainInvariantError, previewTermActivityRevision } from "@/services/redesign";
import type { TermActivityRevisionDetailDraft } from "@/services/redesign/types";
import type {
  TermActivityRevisionPreviewRequest,
  TermActivityRevisionPreviewResponse,
} from "@/lib/redesign-contract";

export type { TermActivityRevisionPreviewRequest, TermActivityRevisionPreviewResponse };

function isNotFoundError(error: DomainInvariantError) {
  return error.message.endsWith("not found");
}

function toDraftDetail(
  detail: Record<string, unknown> & { behaviorFamily: "meeting" | "coursework" | "assessment" },
): TermActivityRevisionDetailDraft {
  if (detail.behaviorFamily === "meeting") {
    return {
      behaviorFamily: "meeting" as const,
      calendarSlotId: (detail.calendarSlotId as string | null | undefined) ?? null,
      startsAt: detail.startsAt ? new Date(detail.startsAt as string) : null,
      endsAt: detail.endsAt ? new Date(detail.endsAt as string) : null,
      status: (detail.status as string | null | undefined) ?? null,
      modality: (detail.modality as string | null | undefined) ?? null,
      overrideReason: (detail.overrideReason as string | null | undefined) ?? null,
      overrideEvidence: detail.overrideEvidence ?? null,
    };
  }
  if (detail.behaviorFamily === "coursework") {
    return {
      behaviorFamily: "coursework" as const,
      lifecycleState: (detail.lifecycleState as string | null | undefined) ?? null,
      deliveryNotes: (detail.deliveryNotes as string | null | undefined) ?? null,
    };
  }
  return {
    behaviorFamily: "assessment" as const,
    lifecycleState: (detail.lifecycleState as string | null | undefined) ?? null,
    modality: (detail.modality as string | null | undefined) ?? null,
    deliveryNotes: (detail.deliveryNotes as string | null | undefined) ?? null,
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = termActivityRevisionPreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const preview = await previewTermActivityRevision(prisma, {
      instructorId: instructor.id,
      termActivityId: id,
      draft: {
        title: parsed.data.title,
        summary: parsed.data.summary,
        changeReason: parsed.data.changeReason,
        detail: toDraftDetail(parsed.data.detail),
        topicActions: parsed.data.topicActions?.map((action) => ({
          ...action,
        })),
        milestones: parsed.data.milestones?.map((milestone) => ({
          ...milestone,
          occursAt: milestone.occursAt ? new Date(milestone.occursAt) : null,
        })),
      },
    });
    return ok({
      ...preview,
      proposedRevision: toTermActivityRevisionDto(preview.proposedRevision),
    } satisfies TermActivityRevisionPreviewResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return isNotFoundError(error) ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
