import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, notFound, serverError } from "@/lib/api-helpers";
import { simulateCancellation } from "@/domain/whatif";
import { loadTermData } from "@/lib/term-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { module: true },
    });
    if (!session) return notFound("Session not found");

    const termId = session.module.termId;
    const termData = await loadTermData(termId);
    const impact = simulateCancellation(termData, sessionId);

    return ok(impact);
  } catch (error) {
    console.error("What-if error:", error);
    return serverError("Failed to compute what-if analysis");
  }
}
