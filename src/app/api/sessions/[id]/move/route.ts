import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { moveSessionSchema } from "@/lib/schemas";
import { ok, notFound, handleZodError } from "@/lib/api-helpers";
import {
  computeMoveImpact,
  type CoverageEntry,
} from "@/domain/coverage-rules";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = moveSessionSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  // Get the session and its term
  const session = await prisma.session.findUnique({
    where: { id },
    include: { module: true },
  });
  if (!session) return notFound("Session not found");

  const termId = session.module.termId;

  // Get ALL coverage entries for this term to compute impact
  const allCoverages = await prisma.coverage.findMany({
    where: { session: { module: { termId } } },
    include: {
      session: { include: { module: true } },
    },
  });

  const entries: CoverageEntry[] = allCoverages.map((c) => ({
    sessionId: c.sessionId,
    skillId: c.skillId,
    level: c.level,
    sessionDate: c.session.date,
    sessionSequence: c.session.sequence,
    moduleSequence: c.session.module.sequence,
  }));

  // Compute impact before making the change
  const newDate = parsed.data.date ? new Date(parsed.data.date) : null;
  const newModuleSequence = parsed.data.moduleId
    ? (
        await prisma.module.findUnique({
          where: { id: parsed.data.moduleId },
        })
      )?.sequence ?? session.module.sequence
    : session.module.sequence;
  const newSessionSequence = parsed.data.sequence ?? session.sequence;

  const impact = computeMoveImpact(
    id,
    newDate,
    newModuleSequence,
    newSessionSequence,
    entries,
  );

  // Apply the move
  const updateData: Record<string, unknown> = {};
  if (parsed.data.date !== undefined) {
    updateData.date = parsed.data.date ? new Date(parsed.data.date) : null;
  }
  if (parsed.data.moduleId) updateData.moduleId = parsed.data.moduleId;
  if (parsed.data.sequence !== undefined)
    updateData.sequence = parsed.data.sequence;

  const updated = await prisma.session.update({
    where: { id },
    data: updateData,
    include: { module: true, coverages: { include: { skill: true } } },
  });

  return ok({
    session: updated,
    impact: {
      affectedSkillIds: impact.affectedSkillIds,
      coverageAtRisk: impact.coverageAtRisk.length,
      newViolations: impact.newViolations,
    },
  });
}
