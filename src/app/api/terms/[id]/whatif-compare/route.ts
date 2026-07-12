import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, ok } from "@/lib/api-helpers";
import { compareTermWhatIfScenarios, DomainInvariantError } from "@/services/redesign";
import type { TermWhatIfCompareResponse } from "@/lib/redesign-contract";

export type { TermWhatIfCompareResponse };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionA = request.nextUrl.searchParams.get("sessionA");
  const sessionB = request.nextUrl.searchParams.get("sessionB");
  if (!sessionA || !sessionB) {
    return badRequest("sessionA and sessionB are required");
  }

  try {
    const comparison = await compareTermWhatIfScenarios(prisma, id, sessionA, sessionB);
    return ok(comparison satisfies TermWhatIfCompareResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
