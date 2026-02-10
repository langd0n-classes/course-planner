import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api-helpers";
import { z } from "zod";
import { getAiPlanner } from "@/services/index";
import { simulateCancellation } from "@/domain/whatif";
import { loadTermData } from "@/lib/term-data";

const suggestSchema = z.object({
  canceledSessionId: z.string().uuid(),
  termId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = suggestSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const { canceledSessionId, termId } = parsed.data;

    // Load term data for simulation
    const termData = await loadTermData(termId);
    const impact = simulateCancellation(termData, canceledSessionId);

    // Get at-risk skill IDs (unique coverage only)
    const atRiskSkillIds = impact.atRiskSkills
      .filter((s) => s.uniqueCoverage)
      .map((s) => s.skillId);

    if (atRiskSkillIds.length === 0) {
      return ok([]);
    }

    // Get the canceled session's module
    const canceledSession = await prisma.session.findUnique({
      where: { id: canceledSessionId },
      include: { module: true },
    });

    // Get available sessions with their coverages for context
    const availableSessions = termData.sessions
      .filter(
        (s) =>
          s.id !== canceledSessionId &&
          s.status === "scheduled",
      )
      .map((s) => {
        // Find skill categories covered by this session
        const sessionCoverages = termData.coverages.filter(
          (c) => c.sessionId === s.id,
        );
        const coveredSkillIds = sessionCoverages.map((c) => c.skillId);
        const skillCategories = termData.skills
          .filter((sk) => coveredSkillIds.includes(sk.id))
          .map((sk) => sk.category);

        return {
          id: s.id,
          title: s.title,
          date: s.date,
          moduleId: s.moduleId,
          skillCategories: [...new Set(skillCategories)],
        };
      });

    // Get skill details for the at-risk skills
    const skillDetails = impact.atRiskSkills
      .filter((s) => s.uniqueCoverage)
      .map((s) => {
        const skill = termData.skills.find((sk) => sk.id === s.skillId);
        return {
          id: s.skillId,
          category: skill?.category || "",
          level: s.level,
        };
      });

    const planner = getAiPlanner();
    const suggestions = await planner.suggestRedistribution({
      canceledSessionId,
      affectedSkillIds: atRiskSkillIds,
      availableSessions,
      canceledModuleId: canceledSession?.module?.id,
      skillDetails,
      termContext: `Term ${termId}`,
    });

    return ok(suggestions);
  } catch (error) {
    console.error("Suggest redistribution error:", error);
    return serverError("Failed to suggest redistribution");
  }
}
