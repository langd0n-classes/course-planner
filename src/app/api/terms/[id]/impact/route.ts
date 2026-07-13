import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { computeTermImpact, DomainInvariantError } from "@/services/redesign";
import type { TermImpactResponse } from "@/lib/redesign-contract";

export type { TermImpactResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const impact = await computeTermImpact(prisma, instructor.id, id);
    return ok(impact satisfies TermImpactResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
