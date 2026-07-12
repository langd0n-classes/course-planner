import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, ok } from "@/lib/api-helpers";
import { computeTermImpact, DomainInvariantError } from "@/services/redesign";
import type { TermImpactResponse } from "@/lib/redesign-contract";

export type { TermImpactResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const impact = await computeTermImpact(prisma, id);
    return ok(impact satisfies TermImpactResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
