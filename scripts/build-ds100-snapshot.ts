#!/usr/bin/env -S npx tsx

/* Topic actions are synthesized: a module's first meeting introduces its core
 * topics and every later meeting practices them. This is not source coverage data. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Topic = {
  stableCode: string;
  learningModuleCode: string;
  title: string;
  category: "core" | "extension";
};

type LearningModule = { stableCode: string; title: string };
type Activity = {
  stableCode: string;
  typeKey: string;
  learningModuleCode: string;
  title: string;
  topicActions?: Array<{ topicRef: string; action: "introduced" | "practiced" }>;
};

export type SnapshotReport = {
  unreadLines: string[];
  excludedScheduleRows: Array<{ date: string; meeting: string; reason: string }>;
  unmatchedScheduleModuleCodes: string[];
  topicMapModuleCodesWithoutMeetings: string[];
};

const moduleCode = (value: string) => value.replace(/-/g, "");

export function parseTopicMap(markdown: string): {
  learningModules: LearningModule[];
  topics: Topic[];
  unreadLines: string[];
} {
  const learningModules: LearningModule[] = [];
  const topics: Topic[] = [];
  const unreadLines: string[] = [];
  const lines = markdown.split(/\r?\n/);
  let currentModule: LearningModule | undefined;
  let category: Topic["category"] | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = line.match(/^## (LM-\d{2})\s+(.+)\s*$/);
    if (heading) {
      currentModule = { stableCode: moduleCode(heading[1]), title: heading[2] };
      learningModules.push(currentModule);
      category = undefined;
      continue;
    }
    if (line === "### Core Topics") {
      category = "core";
      continue;
    }
    if (line === "### Extension Topics") {
      category = "extension";
      continue;
    }
    const topic = line.match(/^-\s+(LM\d{2}-[CX]\d{2})\s+(.+)$/);
    if (!topic) continue;
    if (!currentModule || !category) {
      unreadLines.push(`topic map line ${index + 1}: ${line}`);
      continue;
    }
    const titleParts = [topic[2].trim()];
    while (lines[index + 1]?.match(/^\s{2,}\S/)) {
      index += 1;
      titleParts.push((lines[index] ?? "").trim());
    }
    topics.push({
      stableCode: topic[1],
      learningModuleCode: currentModule.stableCode,
      title: titleParts.join(" "),
      category,
    });
  }
  return { learningModules, topics, unreadLines };
}

export function parseSchedule(markdown: string): {
  activities: Activity[];
  activityTypes: Array<{ key: string; behaviorFamily: "meeting"; label: string }>;
  unreadLines: string[];
  excludedScheduleRows: Array<{ date: string; meeting: string; reason: string }>;
} {
  const activities: Activity[] = [];
  const types = new Set<string>();
  const unreadLines: string[] = [];
  const excludedScheduleRows: Array<{ date: string; meeting: string; reason: string }> = [];
  const lines = markdown.split(/\r?\n/);
  const headerCells = ["Date", "Day", "Type", "Meeting", "LM", "Focus", "Prep"];
  const headerIndex = lines.findIndex((line) => {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    return cells.length === headerCells.length && cells.every((cell, index) => cell === headerCells[index]);
  });
  if (headerIndex === -1) {
    return {
      activities,
      activityTypes: [],
      unreadLines: ["schedule: meeting table header not found"],
      excludedScheduleRows,
    };
  }

  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 7 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[0] ?? "")) {
      unreadLines.push(`schedule line ${index + 1}: ${line}`);
      continue;
    }
    const [, , typeKey, meeting, lm, focus] = cells;
    if (!typeKey || !meeting || !lm || !focus) {
      unreadLines.push(`schedule line ${index + 1}: ${line}`);
      continue;
    }
    const reasons = [];
    if (typeKey === "---") reasons.push("Type is ---");
    if (focus.toUpperCase() === "CANCELED") reasons.push("Focus is CANCELED");
    if (reasons.length > 0) {
      excludedScheduleRows.push({ date: cells[0], meeting, reason: reasons.join("; ") });
      continue;
    }
    types.add(typeKey);
    activities.push({
      stableCode: meeting.replace(/\s+/g, "").toUpperCase(),
      typeKey,
      learningModuleCode: moduleCode(lm),
      title: `${meeting}: ${focus}`,
    });
  }
  return {
    activities,
    activityTypes: [...types].sort().map((key) => ({ key, behaviorFamily: "meeting", label: key })),
    unreadLines,
    excludedScheduleRows,
  };
}

export function buildSnapshot(topicMapMarkdown: string, scheduleMarkdown: string): {
  snapshot: {
    snapshotId: string;
    course: { title: string; number: string; description: string };
    activityTypes: Array<{ key: string; behaviorFamily: "meeting"; label: string }>;
    learningModules: LearningModule[];
    topics: Topic[];
    activities: Activity[];
  };
  report: SnapshotReport;
} {
  const topicMap = parseTopicMap(topicMapMarkdown);
  const schedule = parseSchedule(scheduleMarkdown);
  const definedModuleCodes = new Set(topicMap.learningModules.map((module) => module.stableCode));
  const scheduledModuleCodes = new Set(schedule.activities.map((activity) => activity.learningModuleCode));
  const coreTopicsByModule = new Map<string, Topic[]>();
  for (const topic of topicMap.topics) {
    if (topic.category === "core") {
      coreTopicsByModule.set(topic.learningModuleCode, [...(coreTopicsByModule.get(topic.learningModuleCode) ?? []), topic]);
    }
  }
  const meetingCounts = new Map<string, number>();
  const activities = schedule.activities.map((activity) => {
    const count = meetingCounts.get(activity.learningModuleCode) ?? 0;
    meetingCounts.set(activity.learningModuleCode, count + 1);
    return {
      ...activity,
      topicActions: (coreTopicsByModule.get(activity.learningModuleCode) ?? []).map((topic) => ({
        topicRef: topic.stableCode,
        action: count === 0 ? ("introduced" as const) : ("practiced" as const),
      })),
    };
  });

  return {
    snapshot: {
      snapshotId: "ds100-snapshot-v1",
      course: {
        title: "Data Science 100",
        number: "DS-100",
        description: "DS-100 exemplar snapshot generated from course source markdown.",
      },
      activityTypes: schedule.activityTypes,
      learningModules: topicMap.learningModules,
      topics: topicMap.topics,
      activities,
    },
    report: {
      unreadLines: [...topicMap.unreadLines, ...schedule.unreadLines],
      excludedScheduleRows: schedule.excludedScheduleRows,
      unmatchedScheduleModuleCodes: [...scheduledModuleCodes].filter((code) => !definedModuleCodes.has(code)).sort(),
      topicMapModuleCodesWithoutMeetings: [...definedModuleCodes].filter((code) => !scheduledModuleCodes.has(code)).sort(),
    },
  };
}

export function formatReport(snapshot: ReturnType<typeof buildSnapshot>): string {
  const { activities, activityTypes, learningModules, topics } = snapshot.snapshot;
  const coreTopics = topics.filter((topic) => topic.category === "core").length;
  const extensionTopics = topics.filter((topic) => topic.category === "extension").length;
  const topicActions = activities.reduce((count, activity) => count + (activity.topicActions?.length ?? 0), 0);
  const lines = [
    "DS-100 snapshot run report",
    `Counts: Learning Modules=${learningModules.length}, core Topics=${coreTopics}, extension Topics=${extensionTopics}, activity types=${activityTypes.length}, activities=${activities.length}, topic actions=${topicActions}`,
    `Schedule Learning Module codes not in topic map: ${snapshot.report.unmatchedScheduleModuleCodes.join(", ") || "none"}`,
    `Topic map Learning Module codes with no meeting: ${snapshot.report.topicMapModuleCodesWithoutMeetings.join(", ") || "none"}`,
    "Excluded canceled schedule rows:",
    ...(snapshot.report.excludedScheduleRows.length
      ? snapshot.report.excludedScheduleRows.map(({ date, meeting, reason }) => `- ${date} ${meeting}: ${reason}`)
      : ["- none"]),
    "Unread source lines:",
    ...(snapshot.report.unreadLines.length ? snapshot.report.unreadLines.map((line) => `- ${line}`) : ["- none"]),
    "Topic actions are synthesized: the first meeting of each Learning Module introduces its core Topics; later meetings practice them. This is not source coverage data.",
  ];
  return lines.join("\n");
}

function main(args: string[]) {
  if (args.length !== 3) {
    throw new Error("Usage: ./scripts/build-ds100-snapshot.ts <topic-map-path> <schedule-path> <output-path>");
  }
  const [topicMapPath, schedulePath, outputPath] = args.map((value) => resolve(value));
  const result = buildSnapshot(readFileSync(topicMapPath, "utf8"), readFileSync(schedulePath, "utf8"));
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result.snapshot, null, 2)}\n`);
  console.log(formatReport(result));
}

if (process.argv[1]?.endsWith("build-ds100-snapshot.ts")) {
  main(process.argv.slice(2));
}
