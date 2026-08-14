import { describe, expect, it } from "vitest";
import { ExemplarImportService } from "../src/services/redesign/exemplar-import-service";
import {
  buildSnapshot,
  formatReport,
  parseSchedule,
  parseTopicMap,
} from "./build-ds100-snapshot";

describe("DS-100 snapshot builder", () => {
  it("parses learning modules and core topics", () => {
    const parsed = parseTopicMap(`## LM-00 Onboarding\n\n### Core Topics\n\n- LM00-C01 Course workflow.\n`);

    expect(parsed.learningModules).toEqual([{ stableCode: "LM00", title: "Onboarding" }]);
    expect(parsed.topics).toEqual([
      {
        stableCode: "LM00-C01",
        learningModuleCode: "LM00",
        title: "Course workflow.",
        category: "core",
      },
    ]);
  });

  it("joins wrapped topic lines and distinguishes core from extension topics", () => {
    const parsed = parseTopicMap(`## LM-01 Programming\n\n### Core Topics\n\n- LM01-C01 A topic that wraps\n  onto the next line.\n\n### Extension Topics\n\n- LM01-X01 An extension topic.\n`);

    expect(parsed.topics).toEqual([
      {
        stableCode: "LM01-C01",
        learningModuleCode: "LM01",
        title: "A topic that wraps onto the next line.",
        category: "core",
      },
      {
        stableCode: "LM01-X01",
        learningModuleCode: "LM01",
        title: "An extension topic.",
        category: "extension",
      },
    ]);
  });

  it("parses schedule rows into activities", () => {
    const parsed = parseSchedule(`| Date | Day | Type | Meeting | LM | Focus | Prep |\n| --- | --- | --- | --- | --- | --- | --- |\n| 2026-01-20 | Tue | Lec | Lec 01 | LM-00 | Onboard | [L01] |\n`);

    expect(parsed.activities).toEqual([
      {
        stableCode: "LEC01",
        typeKey: "Lec",
        learningModuleCode: "LM00",
        title: "Lec 01: Onboard",
      },
    ]);
  });

  it("excludes placeholder types without creating an activity type", () => {
    const parsed = parseSchedule(`| Date | Day | Type | Meeting | LM | Focus | Prep |\n| --- | --- | --- | --- | --- | --- | --- |\n| 2026-01-27 | Tue | --- | Lec 03 | LM-01 | CANCELED | |\n`);

    expect(parsed.activities).toEqual([]);
    expect(parsed.activityTypes).toEqual([]);
  });

  it("excludes canceled focus rows regardless of letter case", () => {
    const parsed = parseSchedule(`| Date | Day | Type | Meeting | LM | Focus | Prep |\n| --- | --- | --- | --- | --- | --- | --- |\n| 2026-01-29 | Thu | Lec | Lec 04 | LM-01 | canceled | |\n`);

    expect(parsed.activities).toEqual([]);
  });

  it("reports excluded schedule rows separately from unread lines", () => {
    const snapshot = buildSnapshot(
      `## LM-01 Programming\n\n### Core Topics\n\n- LM01-C01 Course workflow.\n`,
      `| Date | Day | Type | Meeting | LM | Focus | Prep |\n| --- | --- | --- | --- | --- | --- | --- |\n| 2026-01-27 | Tue | --- | Lec 03 | LM-01 | CANCELED | |\n`,
    );

    expect(snapshot.report.excludedScheduleRows).toEqual([
      { date: "2026-01-27", meeting: "Lec 03", reason: "Type is ---; Focus is CANCELED" },
    ]);
    expect(snapshot.report.unreadLines).toEqual([]);
    expect(formatReport(snapshot)).toContain("Excluded canceled schedule rows:");
    expect(formatReport(snapshot)).toContain("2026-01-27 Lec 03: Type is ---; Focus is CANCELED");
  });

  it("reports, rather than drops, schedule modules absent from the topic map", () => {
    const snapshot = buildSnapshot(
      `## LM-00 Onboarding\n\n### Core Topics\n\n- LM00-C01 Course workflow.\n`,
      `| Date | Day | Type | Meeting | LM | Focus | Prep |\n| --- | --- | --- | --- | --- | --- | --- |\n| 2026-01-20 | Tue | Lec | Lec 01 | LM-99 | Unknown | [L01] |\n`,
    );

    expect(snapshot.report.unmatchedScheduleModuleCodes).toEqual(["LM99"]);
    expect(snapshot.snapshot.activities).toHaveLength(1);
  });

  it("introduces core topics at a module's first meeting and practices them later", () => {
    const snapshot = buildSnapshot(
      `## LM-00 Onboarding\n\n### Core Topics\n\n- LM00-C01 Course workflow.\n\n### Extension Topics\n\n- LM00-X01 Extra setup.\n`,
      `| Date | Day | Type | Meeting | LM | Focus | Prep |\n| --- | --- | --- | --- | --- | --- | --- |\n| 2026-01-20 | Tue | Lec | Lec 01 | LM-00 | Start | [L01] |\n| 2026-01-22 | Thu | Lec | Lec 02 | LM-00 | Continue | [L02] |\n`,
    );

    expect(snapshot.snapshot.activities.map((activity) => activity.topicActions)).toEqual([
      [{ topicRef: "LM00-C01", action: "introduced" }],
      [{ topicRef: "LM00-C01", action: "practiced" }],
    ]);
  });

  it("produces a snapshot accepted by ExemplarImportService", () => {
    const { snapshot } = buildSnapshot(
      `## LM-00 Onboarding\n\n### Core Topics\n\n- LM00-C01 Course workflow.\n`,
      `| Date | Day | Type | Meeting | LM | Focus | Prep |\n| --- | --- | --- | --- | --- | --- | --- |\n| 2026-01-20 | Tue | Lec | Lec 01 | LM-00 | Start | [L01] |\n`,
    );

    expect(new ExemplarImportService().stage(snapshot).snapshot).toEqual(snapshot);
  });
});
