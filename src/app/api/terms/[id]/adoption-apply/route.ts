import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { termAdoptionApplyRequestSchema } from "@/lib/redesign-schemas";
import { ConcurrencyConflictError, DomainInvariantError, applyTermActivityAdoption } from "@/services/redesign";
import { toTermActivityDto } from "@/lib/redesign-serializers";
import type {
  TermAdoptionApplyRequest,
  TermAdoptionApplyResponse,
} from "@/lib/redesign-contract";

export type { TermAdoptionApplyRequest, TermAdoptionApplyResponse };

function isNotFoundError(error: DomainInvariantError) {
  return error.message.endsWith("not found");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = termAdoptionApplyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const applied = await applyTermActivityAdoption(prisma, {
      instructorId: instructor.id,
      termId: id,
      learningModuleVersionSelections: parsed.data.learningModuleVersionSelections,
      crossCuttingSelections: parsed.data.crossCuttingSelections,
      previewToken: parsed.data.previewToken,
      expectedCurrentActivityCount: parsed.data.expectedCurrentActivityCount,
    });
    return ok({
      kind: "applied",
      termActivities: applied.termActivities.map(toTermActivityDto),
    } satisfies TermAdoptionApplyResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return isNotFoundError(error) ? notFound(error.message) : badRequest(error.message);
    }
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    throw error;
  }
}
