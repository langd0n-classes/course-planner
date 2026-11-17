/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { createTopicSchema } from "@/lib/redesign-schemas";
import { toTopicDto } from "@/lib/redesign-serializers";
import { previewHardRemoval } from "./archive-removal-service";
import { computeTermImpact } from "./planning-service";
import { createLearningModuleVersion, createTopic, updateTopic } from "./revision-service";

const database = (tx: any) => ({ $transaction: async (fn: any) => fn(tx) });

describe("Topics independent of module ownership", () => {
  it("serializes a Topic with null legacy ownership without exposing the column", () => {
    expect(
      toTopicDto({
        id: "t",
        courseId: "c",
        learningModuleId: null,
        stableCode: "opaque",
        currentVersionId: null,
        archivedAt: null,
      } as any),
    ).not.toHaveProperty("learningModuleId");
  });

  it("creates and saves a Topic without a module code or ownership write", async () => {
    const topic = {
      id: "t",
      courseId: "c",
      stableCode: "opaque",
      learningModuleId: null,
    };
    const create = vi.fn(async () => topic);
    const findUnique = vi.fn(async () => topic);
    const tx = {
      topic: {
        create,
        findUnique,
        update: vi.fn(async ({ data }: any) => ({ ...topic, ...data })),
      },
      topicVersion: { create: async () => ({ id: "tv" }) },
      course: { findUnique: async () => ({ id: "c" }) },
    };
    await createTopic(database(tx), {
      courseId: "c",
      stableCode: "opaque",
      createdByInstructorId: "i",
      draft: { title: "Topic" },
    });
    expect(create.mock.calls[0]).toEqual([
      { data: { courseId: "c", stableCode: "opaque" } },
    ]);
    await updateTopic(database(tx), "i", "t", { stableCode: "opaque" });
    expect(findUnique.mock.calls[0]).toEqual([
      {
        where: { id: "t" },
        select: { id: true, courseId: true, stableCode: true },
      },
    ]);
  });

  it("counts distinct Topics across module revisions for removal", async () => {
    const findMany = vi.fn(async () => [
      { topicVersion: { topicId: "t" } },
      { topicVersion: { topicId: "t" } },
    ]);
    const preview = await previewHardRemoval(
      database({
        learningModule: { findUnique: async () => ({ id: "lm" }) },
        topic: {
          count: () => {
            throw new Error("Legacy ownership must not be queried");
          },
        },
        learningModuleVersionTopic: { findMany },
        termLearningModule: { count: async () => 0 },
        artifact: { count: async () => 0 },
      }),
      "learning_module",
      "lm",
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { learningModuleVersion: { learningModuleId: "lm" } },
      select: { topicVersion: { select: { topicId: true } } },
    });
    expect(preview.blockers).toContainEqual(
      expect.objectContaining({ code: "topics_assigned", count: 1, message: expect.stringContaining("1 Topic linked") }),
    );
  });

  it("allows coverage of a Topic absent from the module snapshot", async () => {
    const topicVersion = {
      id: "tv",
      topicId: "t",
      topic: { id: "t", courseId: "c", learningModuleId: null },
    };
    const term = {
      id: "term",
      courseId: "c",
      status: "planned",
      course: { instructorId: "i" },
      learningModules: [
        {
          id: "offering",
          learningModuleVersion: { topics: [] },
          deliveredLearningModuleVersion: null,
        },
      ],
      sessions: [
        {
          id: "s",
          code: "S",
          title: "Session",
          date: null,
          status: "scheduled",
          sequence: 1,
          termLearningModuleId: "offering",
          termLearningModule: {
            id: "offering",
            sequence: 1,
            learningModuleId: "lm",
          },
          coverages: [
            { topicVersionId: "tv", topicVersion, level: "introduced" },
          ],
        },
      ],
      assessments: [],
      calendarSlots: [],
    };
    const impact = await computeTermImpact(
      database({ term: { findUnique: async () => term } }),
      "i",
      "term",
    );
    expect(impact.issues.filter((issue: any) => issue.code === "coverage_out_of_offering")).toEqual([]);
  });

  it("accepts a legacy module field in a Topic request and strips it", () => {
    const parsed = createTopicSchema.parse({
      stableCode: "T", createdByInstructorId: "00000000-0000-4000-8000-000000000001",
      learningModuleId: "ignored", version: { title: "Topic" },
    });
    expect(parsed).not.toHaveProperty("learningModuleId");
  });

  it("rejects snapshots from another Course and shares a Topic across modules", async () => {
    const create = vi.fn(async ({ data }: any) => data);
    const tx = {
      topicVersion: { findUnique: async () => ({ topic: { courseId: "c" } }) },
      learningModuleVersion: { create },
    };
    const snapshot = (id: string, courseId: string) => createLearningModuleVersion(tx as any, {
      learningModule: { id, courseId }, revision: 1, createdByInstructorId: "i",
      publishedAt: null, draft: { title: id, topics: [{ topicVersionId: "tv", sequence: 0 }] },
    });
    await expect(snapshot("other", "other-course")).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    for (const id of ["lm1", "lm2"]) {
      const version = await snapshot(id, "c");
      expect(version.topics.create).toEqual([{ topicVersionId: "tv", sequence: 0 }]);
    }
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("keeps the ownership guard inside a single Topic call", () => {
    expect(hasTopicOwnership('tx.topic.findMany({ where: { id: "t" } }); tx.learningModule.findMany({where:{learningModuleId:"lm"}});')).toBe(false);
    expect(hasTopicOwnership('tx.topic.findMany({ select: { learningModuleId: true } });')).toBe(true);
    expect(hasTopicOwnership('tx.topic.create({data:{courseId:"c", learningModuleId:"lm"}});')).toBe(true);
  });

  it("guards known Topic ownership access patterns throughout application sources", () => {
    // Text guard covers the inventoried names, Topic selects/types and creation blocks.
    // It cannot resolve arbitrary aliases or computed property access as a type-aware lint rule could.
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(dir, entry.name))
          : /\.[jt]sx?$/.test(entry.name) && !/\.test\./.test(entry.name)
            ? [path.join(dir, entry.name)]
            : [],
      );
    const violations: string[] = [];
    for (const file of [...walk("src"), ...walk("scripts"), "prisma/seed.ts"]) {
      const source = readFileSync(file, "utf8");
      if (hasTopicOwnership(source)) violations.push(file);
      for (const block of source.matchAll(
        /(?:(?:const topic: TopicDto|type (?:TopicDto|TopicRow|TopicVersionWithTopic|CreateTopicRequest|UpdateTopicRequest)) = \{)([\s\S]*?)\n\}/g,
      )) {
        if (block[1].includes("learningModuleId")) violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});

// Parse call boundaries rather than matching across semicolons or other models.
// This is a narrow syntactic guard: aliases and computed access are not resolved.
function hasTopicOwnership(source: string): boolean {
  const tree = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  const hasKey = (node: ts.Node): boolean =>
    (ts.isPropertyAssignment(node) && node.name.getText(tree).replace(/["']/g, "") === "learningModuleId")
    || ts.forEachChild(node, hasKey) === true;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.name.text === "topic"
      && node.arguments.some(hasKey)) found = true;
    if (ts.isPropertyAccessExpression(node) && node.name.text === "learningModuleId"
      && node.expression.getText(tree) === "topic") found = true;
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === "topic" && hasKey(node.initializer)) found = true;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}
