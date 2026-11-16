import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAiPlanner } from "./index";
import { MockAiPlanner } from "./mocks/mock-ai-planner";

const guidance = 'Read "AI features" in docs/plans/public-demo-design.md.';
const forbidden = [
  "openai", "@anthropic-ai/", "@google/generative-ai", "@google/genai",
  "@ai-sdk/", "ai", "cohere-ai", "@mistralai/", "langchain", "@langchain/", "ollama",
];

describe("simulated AI only", () => {
  it("has no model SDK in any dependency section", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    const matches = ["dependencies", "devDependencies", "optionalDependencies"].flatMap(
      (section) => Object.keys(manifest[section] ?? {})
        .filter((name) => forbidden.some((pattern) =>
          pattern.endsWith("/") ? name.startsWith(pattern) : name === pattern,
        ))
        .map((name) => `${section}: ${name}`),
    );
    expect(matches, guidance).toEqual([]);
  });

  it("resolves the mock planner", () => {
    expect(getAiPlanner(), guidance).toBeInstanceOf(MockAiPlanner);
  });
});
