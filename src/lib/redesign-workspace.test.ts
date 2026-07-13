import { describe, expect, it } from "vitest";
import {
  buildTermCalendarTimeline,
  buildTopicBrowserBuckets,
  compareLearningModuleVersions,
  deriveTermPlanningGaps,
} from "./redesign-workspace";

describe("buildTopicBrowserBuckets", () => {
  it("keeps an explicit Unassigned bucket and preserves empty modules", () => {
    const buckets = buildTopicBrowserBuckets({
      learningModules: [
        { id: "lm-1", courseId: "course-1", stableCode: "PROB", currentVersionId: "lmv-1", archivedAt: null },
        { id: "lm-2", courseId: "course-1", stableCode: "WRAN", currentVersionId: "lmv-2", archivedAt: null },
      ],
      currentVersionsByLearningModuleId: new Map([
        [
          "lm-1",
          {
            id: "lmv-1",
            learningModuleId: "lm-1",
            revision: 1,
            title: "Probability Foundations",
            description: null,
            studentDescription: null,
            learningObjectives: [],
            notes: null,
            defaultSequence: 1,
            changeSummary: null,
            publishedAt: null,
            topics: [],
          },
        ],
        [
          "lm-2",
          {
            id: "lmv-2",
            learningModuleId: "lm-2",
            revision: 1,
            title: "Data Wrangling",
            description: null,
            studentDescription: null,
            learningObjectives: [],
            notes: null,
            defaultSequence: 2,
            changeSummary: null,
            publishedAt: null,
            topics: [],
          },
        ],
      ]),
      topics: [
        {
          id: "topic-1",
          courseId: "course-1",
          learningModuleId: null,
          stableCode: "SQL1",
          currentVersionId: "tv-1",
          archivedAt: null,
        },
      ],
      currentVersionsByTopicId: new Map([
        [
          "topic-1",
          {
            id: "tv-1",
            topicId: "topic-1",
            revision: 1,
            title: "Selecting and filtering",
            category: "SQL",
            description: null,
            changeSummary: null,
            publishedAt: null,
          },
        ],
      ]),
      prerequisites: [],
    });

    expect(buckets[0].label).toBe("Unassigned Topics");
    expect(buckets[0].topics).toHaveLength(1);
    expect(buckets[2].label).toBe("Data Wrangling");
    expect(buckets[2].topics).toHaveLength(0);
  });
});

describe("compareLearningModuleVersions", () => {
  it("surfaces summary and topic reorder/addition changes", () => {
    const comparison = compareLearningModuleVersions({
      base: {
        id: "lmv-1",
        learningModuleId: "lm-1",
        revision: 1,
        title: "Probability Foundations",
        description: "Base description",
        studentDescription: null,
        learningObjectives: ["Reason about random variables"],
        notes: null,
        defaultSequence: 1,
        changeSummary: null,
        publishedAt: null,
        topics: [
          { topicVersionId: "tv-1", sequence: 1 },
          { topicVersionId: "tv-2", sequence: 2 },
        ],
      },
      compare: {
        id: "lmv-2",
        learningModuleId: "lm-1",
        revision: 2,
        title: "Probability Foundations",
        description: "Revised description",
        studentDescription: null,
        learningObjectives: ["Reason about random variables", "Compare probability models"],
        notes: "Updated",
        defaultSequence: 1,
        changeSummary: null,
        publishedAt: null,
        topics: [
          { topicVersionId: "tv-2", sequence: 1 },
          { topicVersionId: "tv-1", sequence: 2 },
          { topicVersionId: "tv-3", sequence: 3 },
        ],
      },
      topicVersionsById: new Map([
        ["tv-1", { id: "tv-1", topicId: "topic-1", revision: 1, title: "Sample spaces", category: null, description: null, changeSummary: null, publishedAt: null }],
        ["tv-2", { id: "tv-2", topicId: "topic-2", revision: 1, title: "Random variables", category: null, description: null, changeSummary: null, publishedAt: null }],
        ["tv-3", { id: "tv-3", topicId: "topic-3", revision: 1, title: "Expectation", category: null, description: null, changeSummary: null, publishedAt: null }],
      ]),
    });

    expect(comparison.summary).toContain("Description changed.");
    expect(comparison.summary).toContain("Learning objectives changed.");
    expect(comparison.topicChanges).toEqual([
      { kind: "added", title: "Expectation", baseSequence: null, compareSequence: 3 },
      { kind: "reordered", title: "Random variables", baseSequence: 2, compareSequence: 1 },
      { kind: "reordered", title: "Sample spaces", baseSequence: 1, compareSequence: 2 },
    ]);
  });
});

describe("deriveTermPlanningGaps", () => {
  it("reports both empty class days and undated sessions", () => {
    const gaps = deriveTermPlanningGaps({
      calendarSlots: [
        {
          id: "slot-1",
          termId: "term-1",
          academicCalendarEventId: null,
          date: "2026-01-20",
          slotType: "class_day",
          label: null,
          source: null,
          instructionalCapacity: "normal",
          capacitySource: "baseline",
          capacityReason: null,
        },
        {
          id: "slot-2",
          termId: "term-1",
          academicCalendarEventId: null,
          date: "2026-01-22",
          slotType: "class_day",
          label: null,
          source: null,
          instructionalCapacity: "normal",
          capacitySource: "baseline",
          capacityReason: null,
        },
      ],
      sessions: [
        {
          id: "sess-1",
          termId: "term-1",
          termLearningModuleId: "tlm-1",
          calendarSlotId: "slot-1",
          sequence: 1,
          sessionType: "lecture",
          code: "L01",
          title: "Introduction",
          date: "2026-01-20",
          scheduleOverrideLabel: null,
          description: null,
          format: null,
          notes: null,
          status: "scheduled",
          instructionalMode: "standard",
          canceledAt: null,
          canceledReason: null,
          archivedAt: null,
        },
        {
          id: "sess-2",
          termId: "term-1",
          termLearningModuleId: "tlm-1",
          calendarSlotId: null,
          sequence: 2,
          sessionType: "lecture",
          code: "L02",
          title: "Variables",
          date: null,
          scheduleOverrideLabel: null,
          description: null,
          format: null,
          notes: null,
          status: "scheduled",
          instructionalMode: "standard",
          canceledAt: null,
          canceledReason: null,
          archivedAt: null,
        },
      ],
    });

    expect(gaps.unplannedClassDays.map((slot) => slot.id)).toEqual(["slot-2"]);
    expect(gaps.unscheduledSessions.map((session) => session.id)).toEqual(["sess-2"]);
  });
});

describe("buildTermCalendarTimeline", () => {
  it("anchors the default window around today and reports progress", () => {
    const timeline = buildTermCalendarTimeline({
      calendarSlots: Array.from({ length: 18 }, (_, index) => ({
        id: `slot-${index + 1}`,
        termId: "term-1",
        academicCalendarEventId: null,
        date: `2026-02-${String(index + 1).padStart(2, "0")}`,
        slotType: "class_day",
        label: null,
        source: null,
        instructionalCapacity: "normal",
        capacitySource: "baseline",
        capacityReason: null,
      })),
      sessions: [
        {
          id: "sess-9",
          termId: "term-1",
          termLearningModuleId: "tlm-1",
          calendarSlotId: "slot-9",
          sequence: 9,
          sessionType: "lecture",
          code: "L09",
          title: "Center point",
          date: "2026-02-09",
          scheduleOverrideLabel: null,
          description: null,
          format: null,
          notes: null,
          status: "scheduled",
          instructionalMode: "standard",
          canceledAt: null,
          canceledReason: null,
          archivedAt: null,
        },
      ],
      today: "2026-02-09",
    });

    expect(timeline.windowRows.map((row) => row.slot.id)).toEqual([
      "slot-2",
      "slot-3",
      "slot-4",
      "slot-5",
      "slot-6",
      "slot-7",
      "slot-8",
      "slot-9",
      "slot-10",
      "slot-11",
      "slot-12",
      "slot-13",
      "slot-14",
      "slot-15",
      "slot-16",
    ]);
    expect(timeline.hiddenBeforeCount).toBe(1);
    expect(timeline.hiddenAfterCount).toBe(2);
    expect(timeline.completedClassDays).toBe(9);
    expect(timeline.totalClassDays).toBe(18);
    expect(timeline.progressPercent).toBe(50);
    expect(timeline.todaySignal).toBe("today_class_day");
    expect(timeline.windowRows.find((row) => row.slot.id === "slot-9")?.isToday).toBe(true);
  });

  it("treats canceled sessions as visible planning gaps", () => {
    const timeline = buildTermCalendarTimeline({
      calendarSlots: [
        {
          id: "slot-1",
          termId: "term-1",
          academicCalendarEventId: null,
          date: "2026-03-01",
          slotType: "class_day",
          label: null,
          source: null,
          instructionalCapacity: "normal",
          capacitySource: "baseline",
          capacityReason: null,
        },
      ],
      sessions: [
        {
          id: "sess-1",
          termId: "term-1",
          termLearningModuleId: "tlm-1",
          calendarSlotId: "slot-1",
          sequence: 1,
          sessionType: "lecture",
          code: "L01",
          title: "Snow day",
          date: "2026-03-01",
          scheduleOverrideLabel: null,
          description: null,
          format: null,
          notes: null,
          status: "canceled",
          instructionalMode: "standard",
          canceledAt: "2026-02-28T18:00:00.000Z",
          canceledReason: "weather",
          archivedAt: null,
        },
      ],
      today: "2026-03-02",
    });

    expect(timeline.allRows).toHaveLength(1);
    expect(timeline.allRows[0]?.isGap).toBe(true);
    expect(timeline.todaySignal).toBe("after_term");
  });
});
