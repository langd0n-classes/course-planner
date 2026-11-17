import { NotFoundError } from "@/services/redesign/errors";
import { toMilestoneDatingPreviewDto } from "@/lib/redesign-serializers";
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
import { milestoneDatingPreviewRequestSchema } from "@/lib/redesign-schemas";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
  previewMilestoneDating,
} from "@/services/redesign";
import type {
  MilestoneDatingPreviewRequest,
  MilestoneDatingPreviewResponse,
} from "@/lib/redesign-contract";
export type { MilestoneDatingPreviewRequest, MilestoneDatingPreviewResponse };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const parsed = milestoneDatingPreviewRequestSchema.safeParse(
    await request.json(),
  );
  if (!parsed.success)
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  try {
    const result = await previewMilestoneDating(prisma, {
      instructorId: instructor.id,
      termId: id,
      ...parsed.data,
    });
    return ok(
      toMilestoneDatingPreviewDto(
        result,
      ) satisfies MilestoneDatingPreviewResponse,
    );
  } catch (error) {
    if (error instanceof ConcurrencyConflictError)
      return conflict(error.message);
    if (error instanceof DomainInvariantError)
      return error instanceof NotFoundError ? notFound(error.message) : badRequest(error.message);
    throw error;
  }
}
