/**
 * Service registry — single place to get service instances.
 * In production, swap mocks for real implementations.
 */

import type { AiPlanner } from "./interfaces/ai-planner";
import type { ArtifactExporter } from "./interfaces/artifact-exporter";
import { MockAiPlanner } from "./mocks/mock-ai-planner";
import { MockArtifactExporter } from "./mocks/mock-artifact-exporter";

let aiPlanner: AiPlanner | null = null;
let artifactExporter: ArtifactExporter | null = null;

export function getAiPlanner(): AiPlanner {
  if (!aiPlanner) {
    // Future: check env vars to decide which implementation to use
    // if (process.env.OPENAI_API_KEY) aiPlanner = new OpenAiPlanner(...)
    // if (process.env.ANTHROPIC_API_KEY) aiPlanner = new AnthropicPlanner(...)
    aiPlanner = new MockAiPlanner();
  }
  return aiPlanner;
}

export function getArtifactExporter(): ArtifactExporter {
  if (!artifactExporter) {
    artifactExporter = new MockArtifactExporter();
  }
  return artifactExporter;
}

// For testing: allow injection
export function setAiPlanner(planner: AiPlanner) {
  aiPlanner = planner;
}

export function setArtifactExporter(exporter: ArtifactExporter) {
  artifactExporter = exporter;
}
