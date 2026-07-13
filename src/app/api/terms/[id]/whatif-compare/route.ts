import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { compareTermWhatIfScenarios, DomainInvariantError } from "@/services/redesign";
import type { TermWhatIfCompareResponse } from "@/lib/redesign-contract";

export type { TermWhatIfCompareResponse };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const sessionA = request.nextUrl.searchParams.get("sessionA");
  const sessionB = request.nextUrl.searchParams.get("sessionB");
  if (!sessionA || !sessionB) {
    return badRequest("sessionA and sessionB are required");
  }

  try {
    const comparison = await compareTermWhatIfScenarios(
      prisma,
      instructor.id,
      id,
      sessionA,
      sessionB,
    );
    return ok(comparison satisfies TermWhatIfCompareResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term not found" || error.message === "Session not found for this Term"
        ? notFound(error.message)
        : badRequest(error.message);
    }
    throw error;
  }
}
