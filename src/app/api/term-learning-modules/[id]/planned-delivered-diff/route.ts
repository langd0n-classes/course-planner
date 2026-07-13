import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { computePlannedDeliveredDiff, DomainInvariantError } from "@/services/redesign";
import type { PlannedDeliveredDiffResponse } from "@/lib/redesign-contract";

export type { PlannedDeliveredDiffResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const diff = await computePlannedDeliveredDiff(prisma, instructor.id, id);
    return ok(diff satisfies PlannedDeliveredDiffResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term Learning Module not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
