/**
 * AI Planner service interface.
 * Designed for future OpenAI (ChatGPT) and Anthropic (Claude) adapters.
 */

export interface RedistributionSuggestion {
  targetSessionId: string;
  skillId: string;
  suggestedLevel: "introduced" | "practiced" | "assessed";
  rationale: string;
  confidence: number; // 0-1
}

export interface CoverageAnalysis {
  gaps: Array<{
    skillId: string;
    issue: string;
    suggestion: string;
  }>;
  strengths: string[];
  overallScore: number; // 0-100
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiPlannerConfig {
  provider: "openai" | "anthropic" | "mock";
  apiKey?: string;
  model?: string;
}

export interface AiPlanner {
  /**
   * Suggest how to redistribute skills when a session is canceled or moved.
   */
  suggestRedistribution(context: {
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
  }): Promise<RedistributionSuggestion[]>;

  /**
   * Analyze coverage matrix and identify weaknesses.
   */
  analyzeCoverage(context: {
    coverageMatrix: string;
    skills: Array<{ id: string; code: string; description: string }>;
    termContext: string;
  }): Promise<CoverageAnalysis>;

  /**
   * Chat with the AI about course design, with course context.
   */
  chat(
    messages: ChatMessage[],
    courseContext: string,
  ): Promise<ChatMessage>;
}
