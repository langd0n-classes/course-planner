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
import { milestoneDatingApplyRequestSchema } from "@/lib/redesign-schemas";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
  applyMilestoneDating,
} from "@/services/redesign";
import type {
  MilestoneDatingApplyRequest,
  MilestoneDatingApplyResponse,
} from "@/lib/redesign-contract";
export type { MilestoneDatingApplyRequest, MilestoneDatingApplyResponse };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  const parsed = milestoneDatingApplyRequestSchema.safeParse(
    await request.json(),
  );
  if (!parsed.success)
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  try {
    const result = await applyMilestoneDating(prisma, {
      instructorId: instructor.id,
      termId: id,
      ...parsed.data,
    });
    return ok(result satisfies MilestoneDatingApplyResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError)
      return conflict(error.message);
    if (error instanceof DomainInvariantError)
      return error.message.endsWith("not found")
        ? notFound(error.message)
        : badRequest(error.message);
    throw error;
  }
}
