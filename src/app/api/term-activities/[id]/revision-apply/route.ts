import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTermActivityDto, toTermActivityRevisionDto } from "@/lib/redesign-serializers";
import { termActivityRevisionApplyRequestSchema } from "@/lib/redesign-schemas";
import { ConcurrencyConflictError, DomainInvariantError, applyTermActivityRevision } from "@/services/redesign";
import type { TermActivityRevisionDetailDraft } from "@/services/redesign/types";
import type {
  TermActivityRevisionApplyRequest,
  TermActivityRevisionApplyResponse,
} from "@/lib/redesign-contract";

export type { TermActivityRevisionApplyRequest, TermActivityRevisionApplyResponse };

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
  const parsed = termActivityRevisionApplyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const applied = await applyTermActivityRevision(prisma, {
      instructorId: instructor.id,
      termActivityId: id,
      expectedCurrentRevisionId: parsed.data.expectedCurrentRevisionId ?? null,
      previewToken: parsed.data.previewToken,
      advancePointer: parsed.data.advancePointer,
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
      kind: "applied",
      termActivity: toTermActivityDto(applied.termActivity),
      revision: toTermActivityRevisionDto(applied.revision),
    } satisfies TermActivityRevisionApplyResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return isNotFoundError(error) ? notFound(error.message) : badRequest(error.message);
    }
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    throw error;
  }
}
