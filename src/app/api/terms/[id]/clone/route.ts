import { NotFoundError } from "@/services/redesign/errors";
import { ConcurrencyConflictError } from "@/services/redesign/errors";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized, conflict } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { cloneTermSchema } from "@/lib/redesign-schemas";
import { toTermDto } from "@/lib/redesign-serializers";
import { applyTermClone, DomainInvariantError, previewTermClone } from "@/services/redesign";
import type {
  CloneTermApplyResponse,
  CloneTermPreviewResponse,
  CloneTermRequest,
  CloneTermResponse,
} from "@/lib/redesign-contract";

export type {
  CloneTermApplyResponse,
  CloneTermPreviewResponse,
  CloneTermRequest,
  CloneTermResponse,
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = cloneTermSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    if (parsed.data.mode === "preview") {
      const preview = await previewTermClone(prisma, {
        instructorId: instructor.id,
        sourceTermId: id,
        ...parsed.data,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      });
      return ok(preview satisfies CloneTermPreviewResponse);
    }

    const applied = await applyTermClone(prisma, {
      instructorId: instructor.id,
      sourceTermId: id,
      ...parsed.data,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });
    return ok({
      kind: "applied",
      term: toTermDto(applied.term),
    } satisfies CloneTermApplyResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    if (error instanceof DomainInvariantError) {
      return error instanceof NotFoundError ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
