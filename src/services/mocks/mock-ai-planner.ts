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
    availableSessions: Array<{ id: string; title: string; date: Date | null }>;
    termContext: string;
  }): Promise<RedistributionSuggestion[]> {
    // Return mock suggestions — spread skills across available sessions
    return context.affectedSkillIds.flatMap((skillId, i) => {
      const target =
        context.availableSessions[i % context.availableSessions.length];
      if (!target) return [];
      return [
        {
          targetSessionId: target.id,
          skillId,
          suggestedLevel: "practiced" as const,
          rationale: `[Mock] Suggested moving skill to "${target.title}" based on topic proximity.`,
          confidence: 0.75,
        },
      ];
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
