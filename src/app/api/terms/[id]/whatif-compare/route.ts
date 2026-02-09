import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api-helpers";
import { compareScenarios } from "@/domain/whatif";
import { loadTermData } from "@/lib/term-data";

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

    // Validate both sessions exist and belong to this term
    const [sessA, sessB] = await Promise.all([
      prisma.session.findUnique({
        where: { id: sessionA },
        include: { module: { select: { termId: true } } },
      }),
      prisma.session.findUnique({
        where: { id: sessionB },
        include: { module: { select: { termId: true } } },
      }),
    ]);

    if (!sessA) return badRequest(`Session not found: ${sessionA}`);
    if (!sessB) return badRequest(`Session not found: ${sessionB}`);
    if (sessA.module.termId !== termId) {
      return badRequest(`Session ${sessionA} does not belong to term ${termId}`);
    }
    if (sessB.module.termId !== termId) {
      return badRequest(`Session ${sessionB} does not belong to term ${termId}`);
    }

    const termData = await loadTermData(termId);
    const comparison = compareScenarios(termData, sessionA, sessionB);

    return ok(comparison);
  } catch (error) {
    console.error("What-if compare error:", error);
    return serverError("Failed to compare scenarios");
  }
}
