/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildTopicBrowserBuckets } from "@/lib/redesign-workspace";
import { toTopicDto } from "@/lib/redesign-serializers";
import { previewHardRemoval } from "./archive-removal-service";
import { computeTermImpact } from "./planning-service";
import { createTopic, updateTopic } from "./revision-service";

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

  it("groups a null-ownership Topic through Activity actions and historical Topic links", () => {
    const topic = {
      id: "t",
      courseId: "c",
      learningModuleId: null,
      currentVersionId: "tv-new",
      stableCode: "opaque",
      archivedAt: null,
    };
    const oldVersion = { id: "tv-old", topicId: "t" };
    const buckets = buildTopicBrowserBuckets({
      topics: [topic],
      currentVersionsByTopicId: new Map([
        ["t", { ...oldVersion, id: "tv-new" } as any],
      ]),
      prerequisites: [],
      learningModules: [
        {
          id: "lm",
          courseId: "c",
          stableCode: "LM",
          currentVersionId: "lmv",
          archivedAt: null,
        },
      ],
      currentVersionsByLearningModuleId: new Map([
        [
          "lm",
          { topics: [], activities: [{ activityVersionId: "av" }] } as any,
        ],
      ]),
      topicVersionsById: new Map([["tv-old", oldVersion as any]]),
      actionsByActivityVersionId: new Map([
        ["av", [{ topicVersionId: "tv-old" } as any]],
      ]),
    });
    expect(buckets[0].topics).toHaveLength(0);
    expect(buckets[1].topics.map((entry) => entry.topic.id)).toEqual(["t"]);
  });

  it("previews removal through module Topic links, with null ownership on Topics", async () => {
    const count = vi.fn(async () => 1);
    const preview = await previewHardRemoval(
      database({
        learningModule: { findUnique: async () => ({ id: "lm" }) },
        topic: {
          count: () => {
            throw new Error("Legacy ownership must not be queried");
          },
        },
        learningModuleVersionTopic: { count },
        termLearningModule: { count: async () => 0 },
        artifact: { count: async () => 0 },
      }),
      "learning_module",
      "lm",
    );
    expect(count).toHaveBeenCalledWith({
      where: { learningModuleVersion: { learningModuleId: "lm" } },
    });
    expect(preview.blockers).toContainEqual(
      expect.objectContaining({ code: "topics_assigned", count: 1 }),
    );
  });

  it("checks offering coverage using Topic links when legacy ownership is null", async () => {
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
    expect(impact.issues).toContainEqual(
      expect.objectContaining({ code: "coverage_out_of_offering" }),
    );
    (term.learningModules[0].learningModuleVersion.topics as any[]).push({
      topicVersionId: "tv",
      topicVersion,
    });
    const linked = await computeTermImpact(
      database({ term: { findUnique: async () => term } }),
      "i",
      "term",
    );
    expect(
      linked.issues.some(
        (issue: any) => issue.code === "coverage_out_of_offering",
      ),
    ).toBe(false);
    (term.learningModules[0].learningModuleVersion.topics as any[]).length = 0;
    (term.learningModules[0].learningModuleVersion as any).activities = [
      { activityVersion: { topicActions: [{ topicVersion }] } },
    ];
    const throughActivity = await computeTermImpact(
      database({ term: { findUnique: async () => term } }),
      "i",
      "term",
    );
    expect(
      throughActivity.issues.some(
        (issue: any) => issue.code === "coverage_out_of_offering",
      ),
    ).toBe(false);
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
    for (const file of walk("src")) {
      const source = readFileSync(file, "utf8");
      if (
        /\btopic\.learningModuleId|\btopic:\s*\{\s*select:\s*\{[^}]*learningModuleId|\btopic\.(?:count|create|createMany|findUnique|findMany|update|updateMany)\([^;]*?learningModuleId[^;]*?\);/.test(
          source,
        )
      )
        violations.push(file);
      for (const block of source.matchAll(
        /(?:(?:const topic: TopicDto|type (?:TopicDto|TopicRow|TopicVersionWithTopic|CreateTopicRequest|UpdateTopicRequest)) = \{)([\s\S]*?)\n\}/g,
      )) {
        if (block[1].includes("learningModuleId")) violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
