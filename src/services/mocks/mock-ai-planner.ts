import type {
  AiPlanner,
  RedistributionSuggestion,
  CoverageAnalysis,
  ChatMessage,
} from "../interfaces/ai-planner";

export class MockAiPlanner implements AiPlanner {
  async suggestRedistribution(context: {
    canceledSessionId: string;
    affectedSkillIds: string[];
    availableSessions: Array<{
      id: string;
      title: string;
      date: Date | null;
      moduleId?: string;
      skillCategories?: string[];
    }>;
    canceledModuleId?: string;
    skillDetails?: Array<{ id: string; category: string; level: string }>;
    termContext: string;
  }): Promise<RedistributionSuggestion[]> {
    const {
      affectedSkillIds,
      availableSessions,
      canceledModuleId,
      skillDetails,
    } = context;

    if (availableSessions.length === 0) return [];

    return affectedSkillIds.map((skillId, index) => {
      const detail = skillDetails?.find((s) => s.id === skillId);

      // 1. Prefer sessions in the same module as the canceled session
      const sameModuleSessions = canceledModuleId
        ? availableSessions.filter((s) => s.moduleId === canceledModuleId)
        : [];

      // 2. Prefer sessions that already cover related skills (same category)
      const sameCategorySessions = detail?.category
        ? availableSessions.filter((s) =>
            s.skillCategories?.includes(detail.category),
          )
        : [];

      // Pick the best group: same module + same category > same module > same category > all
      const bestBoth = sameModuleSessions.filter((s) =>
        sameCategorySessions.some((sc) => sc.id === s.id),
      );

      const preferredGroup =
        bestBoth.length > 0
          ? bestBoth
          : sameModuleSessions.length > 0
            ? sameModuleSessions
            : sameCategorySessions.length > 0
              ? sameCategorySessions
              : availableSessions;

      // Round-robin within the preferred group to spread the load
      const target = preferredGroup[index % preferredGroup.length];

      const suggestedLevel = (detail?.level || "practiced") as
        | "introduced"
        | "practiced"
        | "assessed";

      const isSameModule = sameModuleSessions.some((s) => s.id === target.id);
      const isSameCategory = sameCategorySessions.some((s) => s.id === target.id);

      return {
        targetSessionId: target.id,
        skillId,
        suggestedLevel,
        rationale: `[Mock AI] Suggested moving to "${target.title}" — ${
          isSameModule && isSameCategory
            ? "same module, related category"
            : isSameModule
              ? "same module"
              : isSameCategory
                ? "related skill category"
                : "next available session"
        }.`,
        confidence: isSameModule && isSameCategory
          ? 0.9
          : isSameModule
            ? 0.8
            : isSameCategory
              ? 0.7
              : 0.5,
      };
    });
  }

  async analyzeCoverage(context: {
    coverageMatrix: string;
    skills: Array<{ id: string; code: string; description: string }>;
    termContext: string;
  }): Promise<CoverageAnalysis> {
    return {
      gaps: context.skills.slice(0, 2).map((s) => ({
        skillId: s.id,
        issue: `[Mock] Skill ${s.code} may need more practice sessions.`,
        suggestion: `Consider adding a practice activity for ${s.code}.`,
      })),
      strengths: [
        "[Mock] Good progression from introduction to assessment.",
        "[Mock] Skills are well-distributed across modules.",
      ],
      overallScore: 72,
    };
  }

  async chat(
    messages: ChatMessage[],
    _courseContext: string,
  ): Promise<ChatMessage> {
    const lastMsg = messages[messages.length - 1];
    return {
      role: "assistant",
      content: `[Mock AI] You asked: "${lastMsg?.content}". This is a mock response. In production, this would use OpenAI or Anthropic APIs with your full course context to provide pedagogical advice.`,
    };
  }
}
