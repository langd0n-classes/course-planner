import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { cancelSessionSchema } from "@/lib/redesign-schemas";
import { toSessionDto } from "@/lib/redesign-serializers";
import { cancelSession, DomainInvariantError } from "@/services/redesign";
import type { CancelSessionRequest, CancelSessionResponse } from "@/lib/redesign-contract";

export type { CancelSessionRequest, CancelSessionResponse };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = cancelSessionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await cancelSession(prisma, {
      instructorId: instructor.id,
      sessionId: id,
      reason: parsed.data.reason,
      redistributions: parsed.data.redistributions,
      dryRun: parsed.data.dryRun,
      force: parsed.data.force,
    });
    if ("valid" in result) {
      return ok(result satisfies CancelSessionResponse);
    }
    return ok({ session: toSessionDto(result) } satisfies CancelSessionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Session not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
