import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const guidance = 'The app has no model SDK and no model API key. An AI feature uses MockAiPlanner. See "AI features" in docs/plans/public-demo-design.md.';

describe("simulated AI only", () => {
  it.each(["openai", "@ai-sdk/openai", "@aws-sdk/client-bedrock-runtime"])(
    "recognizes model SDK %s", (name) => {
      expect(isModelSdk(name)).toBe(true);
    },
  );

  it.each(["next", "aido", "openai-like-name"])(
    "allows non-model package %s", (name) => {
      expect(isModelSdk(name)).toBe(false);
    },
  );

  it("has no model SDK in any dependency section or override", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    const packages = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "overrides"].flatMap(
      (section) => Object.keys(manifest[section] ?? {}).map((name) => ({ section, name })),
    );
    expect(packages.some(({ name }) => name === "next")).toBe(true);
    const matches = packages.filter(({ name }) => isModelSdk(name))
      .map(({ section, name }) => `${section}: ${name}`);
    expect(matches, guidance).toEqual([]);
  });

  it("has no model SDK in the lockfile", () => {
    const lockfile = JSON.parse(readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"));
    const packages = Object.keys(lockfile.packages ?? {})
      .filter((path) => path.includes("node_modules/"))
      .map((path) => path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length));
    expect(packages).toContain("next");
    expect(packages.filter(isModelSdk), guidance).toEqual([]);
  });

  it("has no model API key name in TypeScript source", () => {
    const sourceRoot = new URL("../", import.meta.url);
    const matches = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map((entry) => `${entry.parentPath}/${entry.name}`)
      .filter((path) => path !== new URL(import.meta.url).pathname)
      .filter((path) => readFileSync(path, "utf8").includes("_API_KEY"))
      .map((path) => `src/${path.slice(sourceRoot.pathname.length)}`);
    expect(matches, guidance).toEqual([]);
  });

  it("resolves the mock planner in demo mode", async () => {
    vi.stubEnv("COURSE_PLANNER_DEMO", "true");
    try {
      vi.resetModules();
      const { getAiPlanner } = await import("./index");
      const { MockAiPlanner } = await import("./mocks/mock-ai-planner");
      expect(getAiPlanner(), guidance).toBeInstanceOf(MockAiPlanner);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("resolves the mock planner with the flag unset", async () => {
    vi.stubEnv("COURSE_PLANNER_DEMO", undefined);
    try {
      vi.resetModules();
      const { getAiPlanner } = await import("./index");
      const { MockAiPlanner } = await import("./mocks/mock-ai-planner");
      expect(getAiPlanner(), guidance).toBeInstanceOf(MockAiPlanner);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

function isModelSdk(name: string): boolean {
  const exactNames = [
    "openai", "ai", "cohere-ai", "ollama", "replicate", "together-ai",
    "groq-sdk", "openai-edge", "langchain", "llamaindex",
  ];
  const prefixes = [
    "@anthropic-ai/", "@google/generative-ai", "@google/genai",
    "@google-cloud/vertexai", "@google-cloud/aiplatform", "@ai-sdk/",
    "@mistralai/", "@langchain/", "@huggingface/", "@openrouter/",
    "@aws-sdk/client-bedrock", "@azure/openai", "@azure-rest/ai-",
    "@xenova/transformers", "@llamaindex/",
  ];
  return exactNames.includes(name) || prefixes.some((prefix) => name.startsWith(prefix));
}
