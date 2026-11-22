import { ConcurrencyConflictError, NotFoundError } from "@/services/redesign/errors";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { toTermAdoptionPreviewDto } from "@/lib/redesign-serializers";
import { conflict, badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { termAdoptionPreviewRequestSchema } from "@/lib/redesign-schemas";
import { DomainInvariantError, previewTermActivityAdoption } from "@/services/redesign";
import type {
  TermAdoptionPreviewRequest,
  TermAdoptionPreviewResponse,
} from "@/lib/redesign-contract";

export type { TermAdoptionPreviewRequest, TermAdoptionPreviewResponse };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = termAdoptionPreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const preview = await previewTermActivityAdoption(prisma, {
      instructorId: instructor.id,
      termId: id,
      learningModuleVersionSelections: parsed.data.learningModuleVersionSelections,
      crossCuttingSelections: parsed.data.crossCuttingSelections,
    });
    return ok(toTermAdoptionPreviewDto(preview) satisfies TermAdoptionPreviewResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    if (error instanceof DomainInvariantError) {
      return error instanceof NotFoundError ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
