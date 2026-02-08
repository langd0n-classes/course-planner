import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api-helpers";
import { compareScenarios } from "@/domain/whatif";
import { loadTermData } from "@/app/api/sessions/[id]/whatif/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: termId } = await params;
  const { searchParams } = new URL(request.url);
  const sessionA = searchParams.get("sessionA");
  const sessionB = searchParams.get("sessionB");

  if (!sessionA || !sessionB) {
    return badRequest("Both sessionA and sessionB query params are required");
  }

  try {
    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term) return notFound("Term not found");

    const termData = await loadTermData(termId);
    const comparison = compareScenarios(termData, sessionA, sessionB);

    return ok(comparison);
  } catch (error) {
    console.error("What-if compare error:", error);
    return serverError("Failed to compare scenarios");
  }
}
