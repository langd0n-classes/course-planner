import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { importStructureSchema } from "@/lib/schemas";
import { ok, badRequest, notFound, handleZodError, serverError } from "@/lib/api-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: termId } = await params;

  try {
    const body = await request.json();
    const parsed = importStructureSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { modules, skills, coverages, assessments } = parsed.data;

    // Verify term exists
    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term) return notFound("Term not found");

    // ─── Pre-flight validation ─────────────────────────

    // Collect all session codes from modules
    const sessionCodeSet = new Set<string>();
    for (const mod of modules) {
      for (const sess of mod.sessions) {
        if (sessionCodeSet.has(sess.code)) {
          return badRequest(`Duplicate session code: ${sess.code}`);
        }
        sessionCodeSet.add(sess.code);
      }
    }

    // Collect all skill codes
    const skillCodeSet = new Set(skills.map((s) => s.code));

    // Validate coverage references
    const coverageErrors: string[] = [];
    for (const cov of coverages) {
      if (!sessionCodeSet.has(cov.sessionCode)) {
        coverageErrors.push(
          `Coverage references unknown session: ${cov.sessionCode}`,
        );
      }
      if (!skillCodeSet.has(cov.skillCode)) {
        coverageErrors.push(
          `Coverage references unknown skill: ${cov.skillCode}`,
        );
      }
    }
    if (coverageErrors.length > 0) {
      return badRequest("Referential integrity errors", coverageErrors);
    }

    // Validate assessment skill references
    const assessmentErrors: string[] = [];
    for (const assessment of assessments) {
      for (const skillCode of assessment.skillCodes) {
        if (!skillCodeSet.has(skillCode)) {
          assessmentErrors.push(
            `Assessment ${assessment.code} references unknown skill: ${skillCode}`,
          );
        }
      }
    }
    if (assessmentErrors.length > 0) {
      return badRequest("Referential integrity errors", assessmentErrors);
    }

    // Check for code conflicts with existing data
    const warnings: string[] = [];
    const existingModules = await prisma.module.findMany({
      where: { termId },
      select: { code: true },
    });
    const existingModuleCodes = new Set(existingModules.map((m) => m.code));
    for (const mod of modules) {
      if (existingModuleCodes.has(mod.code)) {
        warnings.push(`Module code already exists: ${mod.code}`);
      }
    }

    const existingSkills = await prisma.skill.findMany({
      where: { termId },
      select: { code: true },
    });
    const existingSkillCodes = new Set(existingSkills.map((s) => s.code));
    for (const skill of skills) {
      if (existingSkillCodes.has(skill.code)) {
        warnings.push(`Skill code already exists: ${skill.code}`);
      }
    }

    if (warnings.length > 0) {
      return badRequest(
        "Code conflicts with existing data (import is additive only)",
        warnings,
      );
    }

    // ─── Transactional import ──────────────────────────

    const result = await prisma.$transaction(async (tx) => {
      const summary = {
        modules: 0,
        sessions: 0,
        skills: 0,
        coverages: 0,
        assessments: 0,
        assessmentSkills: 0,
      };

      // Create modules and sessions
      const sessionIdByCode = new Map<string, string>();

      for (const mod of modules) {
        const createdModule = await tx.module.create({
          data: {
            termId,
            sequence: mod.sequence,
            code: mod.code,
            title: mod.title,
            description: mod.description ?? null,
            learningObjectives: mod.learningObjectives,
          },
        });
        summary.modules++;

        // Auto-assign sequence to sessions within module
        for (let i = 0; i < mod.sessions.length; i++) {
          const sess = mod.sessions[i];
          const createdSession = await tx.session.create({
            data: {
              moduleId: createdModule.id,
              sequence: sess.sequence ?? i + 1,
              sessionType: sess.sessionType,
              code: sess.code,
              title: sess.title,
              date: sess.date ? new Date(sess.date) : null,
              description: sess.description ?? null,
            },
          });
          sessionIdByCode.set(sess.code, createdSession.id);
          summary.sessions++;
        }
      }

      // Create skills
      const skillIdByCode = new Map<string, string>();

      for (const skill of skills) {
        const createdSkill = await tx.skill.create({
          data: {
            code: skill.code,
            category: skill.category,
            description: skill.description,
            isGlobal: false,
            termId,
          },
        });
        skillIdByCode.set(skill.code, createdSkill.id);
        summary.skills++;
      }

      // Create coverages
      for (const cov of coverages) {
        const sessionId = sessionIdByCode.get(cov.sessionCode);
        const skillId = skillIdByCode.get(cov.skillCode);
        if (!sessionId || !skillId) continue; // validated above

        await tx.coverage.create({
          data: {
            sessionId,
            skillId,
            level: cov.level,
          },
        });
        summary.coverages++;
      }

      // Create assessments
      for (const assessment of assessments) {
        const createdAssessment = await tx.assessment.create({
          data: {
            termId,
            code: assessment.code,
            title: assessment.title,
            assessmentType: assessment.assessmentType,
            description: assessment.description ?? null,
            progressionStage: assessment.progressionStage ?? null,
            dueDate: assessment.dueDate ? new Date(assessment.dueDate) : null,
          },
        });
        summary.assessments++;

        // Link skills
        for (const skillCode of assessment.skillCodes) {
          const skillId = skillIdByCode.get(skillCode);
          if (!skillId) continue;
          await tx.assessmentSkill.create({
            data: {
              assessmentId: createdAssessment.id,
              skillId,
            },
          });
          summary.assessmentSkills++;
        }
      }

      return summary;
    });

    return ok(result);
  } catch (error) {
    console.error("Structure import error:", error);
    return serverError("Failed to import structure");
  }
}
