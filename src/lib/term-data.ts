import prisma from "@/lib/prisma";
import type { TermData } from "@/domain/whatif";
import type { CoverageEntry } from "@/domain/coverage-rules";

/**
 * Load full term data (sessions, coverages, skills) for what-if analysis.
 * Used by whatif, whatif-compare, and cancel routes.
 */
export async function loadTermData(termId: string): Promise<TermData> {
  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: {
      modules: {
        orderBy: { sequence: "asc" },
        include: {
          sessions: {
            orderBy: { sequence: "asc" },
            include: { coverages: { include: { skill: true } } },
          },
        },
      },
    },
  });

  if (!term) throw new Error("Term not found");

  const sessions = term.modules.flatMap((m) =>
    m.sessions.map((s) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      date: s.date,
      moduleId: m.id,
      moduleSequence: m.sequence,
      sessionSequence: s.sequence,
      status: s.status as "scheduled" | "canceled" | "moved",
    })),
  );

  const coverages: CoverageEntry[] = term.modules.flatMap((m) =>
    m.sessions.flatMap((s) =>
      s.coverages.map((c) => ({
        sessionId: s.id,
        skillId: c.skillId,
        level: c.level as "introduced" | "practiced" | "assessed",
        sessionDate: s.date,
        sessionSequence: s.sequence,
        moduleSequence: m.sequence,
      })),
    ),
  );

  // Get all skills for this term
  const allSkills = await prisma.skill.findMany({
    where: { OR: [{ termId }, { isGlobal: true }] },
  });

  const skills = allSkills.map((s) => ({
    id: s.id,
    code: s.code,
    description: s.description,
    category: s.category,
  }));

  return { sessions, coverages, skills };
}
