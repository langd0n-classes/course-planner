import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, notFound } from "@/lib/api-helpers";
import {
  validateAllCoverageOrdering,
  findOrphanSkills,
  findUnassessedSkills,
  validateGAIEProgression,
  type CoverageEntry,
  type GAIEEntry,
} from "@/domain/coverage-rules";

/**
 * GET /api/terms/[id]/impact
 *
 * Returns a full validation report for a term:
 * - Coverage ordering violations
 * - Orphan skills
 * - Unassessed skills
 * - GAIE progression issues
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const term = await prisma.term.findUnique({
    where: { id },
    include: {
      modules: {
        include: {
          sessions: {
            include: { coverages: true },
          },
        },
      },
      assessments: {
        include: { skills: true },
      },
    },
  });

  if (!term) return notFound("Term not found");

  // Build coverage entries
  const entries: CoverageEntry[] = [];
  for (const mod of term.modules) {
    for (const session of mod.sessions) {
      for (const cov of session.coverages) {
        entries.push({
          sessionId: session.id,
          skillId: cov.skillId,
          level: cov.level,
          sessionDate: session.date,
          sessionSequence: session.sequence,
          moduleSequence: mod.sequence,
        });
      }
    }
  }

  // Get all skill IDs referenced in this term
  const allSkillIds = [
    ...new Set(entries.map((e) => e.skillId)),
  ];

  // Also get skills from assessments
  for (const a of term.assessments) {
    for (const s of a.skills) {
      if (!allSkillIds.includes(s.skillId)) allSkillIds.push(s.skillId);
    }
  }

  // Run validations
  const coverageErrors = validateAllCoverageOrdering(entries);
  const orphans = findOrphanSkills(allSkillIds, entries);
  const unassessed = findUnassessedSkills(entries);

  // GAIE progression
  const gaies: GAIEEntry[] = term.assessments
    .filter((a) => a.assessmentType === "gaie" && a.progressionStage)
    .map((a, i) => ({
      assessmentId: a.id,
      progressionStage: a.progressionStage as GAIEEntry["progressionStage"],
      date: a.dueDate,
      sequence: i,
    }));
  const gaieErrors = validateGAIEProgression(gaies);

  // Modules with no skills
  const modulesWithNoSkills = term.modules
    .filter((m) => {
      const moduleSkills = new Set<string>();
      for (const s of m.sessions) {
        for (const c of s.coverages) {
          moduleSkills.add(c.skillId);
        }
      }
      return moduleSkills.size === 0;
    })
    .map((m) => ({
      type: "module_no_skills" as const,
      message: `Module "${m.title}" (${m.code}) covers no skills`,
      moduleId: m.id,
    }));

  return ok({
    termId: id,
    errors: [...coverageErrors, ...gaieErrors].filter(
      (e) =>
        e.type === "practiced_before_introduced" ||
        e.type === "assessed_before_introduced" ||
        e.type === "assessed_before_practiced" ||
        e.type === "gaie_progression_broken",
    ),
    warnings: [...unassessed, ...modulesWithNoSkills],
    info: orphans,
    summary: {
      totalSkills: allSkillIds.length,
      totalSessions: entries.length
        ? new Set(entries.map((e) => e.sessionId)).size
        : 0,
      totalCoverageEntries: entries.length,
      errorCount: coverageErrors.length + gaieErrors.length,
      warningCount: unassessed.length + modulesWithNoSkills.length,
      infoCount: orphans.length,
    },
  });
}
