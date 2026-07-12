import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, ok } from "@/lib/api-helpers";
import { computePlannedDeliveredDiff, DomainInvariantError } from "@/services/redesign";
import type { PlannedDeliveredDiffResponse } from "@/lib/redesign-contract";

export type { PlannedDeliveredDiffResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const diff = await computePlannedDeliveredDiff(prisma, id);
    return ok(diff satisfies PlannedDeliveredDiffResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
