import { describe, expect, it } from "vitest";
import {
  buildActivityBoardColumns,
  buildTopicFlow,
  buildTermCalendarTimeline,
  buildTermDailyDriver,
  buildTopicBrowserBuckets,
  compareLearningModuleVersions,
  deriveTermPlanningGaps,
  suggestTopicStableCode,
  moveActivityBoardCard,
  planActivityMove,
} from "./redesign-workspace";

function lmVersion(id: string, learningModuleId: string, activities: Array<{ activityVersionId: string; sequence: number; notes: string | null }>) {
  return { id, learningModuleId, revision: 1, title: learningModuleId, description: null, studentDescription: null, learningObjectives: [], notes: null, defaultSequence: 1, changeSummary: null, publishedAt: null, topics: [], activities };
}
const lm = (id: string) => ({ id, courseId: "c", stableCode: id.toUpperCase(), currentVersionId: `${id}-v`, archivedAt: null });

describe("planActivityMove", () => {
  it("puts the destination append before source removals so a partial failure duplicates rather than loses the card", () => {
    const steps = planActivityMove({
      learningModules: [lm("lm-a"), lm("lm-b")],
      currentVersionsByLearningModuleId: new Map([
        ["lm-a", lmVersion("lmv-a", "lm-a", [{ activityVersionId: "av-1", sequence: 1, notes: "keep" }, { activityVersionId: "av-2", sequence: 2, notes: null }])],
        ["lm-b", lmVersion("lmv-b", "lm-b", [{ activityVersionId: "av-3", sequence: 1, notes: null }])],
      ]),
      activityVersionId: "av-1",
      destinationLearningModuleId: "lm-b",
    });

    expect(steps.map((step) => step.learningModuleId)).toEqual(["lm-b", "lm-a"]);
    expect(steps[0]).toEqual({
      learningModuleId: "lm-b",
      expectedCurrentVersionId: "lmv-b",
      activities: [
        { activityVersionId: "av-3", sequence: 1, notes: null },
        { activityVersionId: "av-1", sequence: 2, notes: null },
      ],
    });
    expect(steps[1]).toEqual({
      learningModuleId: "lm-a",
      expectedCurrentVersionId: "lmv-a",
      activities: [{ activityVersionId: "av-2", sequence: 1, notes: null }],
    });
  });

  it("plans only source removals when moving to unassigned, and removes from every module holding the card", () => {
    const steps = planActivityMove({
      learningModules: [lm("lm-a"), lm("lm-b")],
      currentVersionsByLearningModuleId: new Map([
        ["lm-a", lmVersion("lmv-a", "lm-a", [{ activityVersionId: "av-1", sequence: 1, notes: null }])],
        ["lm-b", lmVersion("lmv-b", "lm-b", [{ activityVersionId: "av-1", sequence: 1, notes: null }, { activityVersionId: "av-2", sequence: 2, notes: null }])],
      ]),
      activityVersionId: "av-1",
      destinationLearningModuleId: null,
    });

    expect(steps.map((step) => step.learningModuleId)).toEqual(["lm-a", "lm-b"]);
    expect(steps[0]?.activities).toEqual([]);
    expect(steps[1]?.activities).toEqual([{ activityVersionId: "av-2", sequence: 1, notes: null }]);
  });

  it("plans nothing when the card is already only in the destination", () => {
    expect(planActivityMove({
      learningModules: [lm("lm-a")],
      currentVersionsByLearningModuleId: new Map([
        ["lm-a", lmVersion("lmv-a", "lm-a", [{ activityVersionId: "av-1", sequence: 1, notes: null }])],
      ]),
      activityVersionId: "av-1",
      destinationLearningModuleId: "lm-a",
    })).toEqual([]);
  });
});

describe("activity board placement", () => {
  it("moves a card through one domain action without duplicating it", () => {
    expect(moveActivityBoardCard({ columns: [
      { key: "unassigned", label: "Unassigned", activityVersionIds: ["av-1"] },
      { key: "lm-1", label: "Foundations", activityVersionIds: [] },
    ], activityVersionId: "av-1", destinationKey: "lm-1" })).toEqual([
      { key: "unassigned", label: "Unassigned", activityVersionIds: [] },
      { key: "lm-1", label: "Foundations", activityVersionIds: ["av-1"] },
    ]);
  });

  it("derives board placement and topic flow from activity versions, never Topic.learningModuleId", () => {
    const version = { id: "av-1", activityId: "a-1", revision: 1, title: "Workshop", summary: null, activityTypeVersionId: "type-1", changeSummary: null, publishedAt: null, detail: { behaviorFamily: "meeting" as const, defaultDurationMinutes: null, modality: null, preparationNotes: null, authoringNotes: null }, milestoneTemplates: [] };
    const columns = buildActivityBoardColumns({ learningModules: [{ id: "lm-1", courseId: "c", stableCode: "F", currentVersionId: "lmv-1", archivedAt: null }], currentVersionsByLearningModuleId: new Map([["lm-1", { id: "lmv-1", learningModuleId: "lm-1", revision: 1, title: "Foundations", description: null, studentDescription: null, learningObjectives: [], notes: null, defaultSequence: 1, changeSummary: null, publishedAt: null, topics: [], activities: [{ activityVersionId: "av-1", sequence: 1, notes: null }] }]]), activities: [{ id: "a-1", courseId: "c", stableCode: "A1", currentVersionId: "av-1", archivedAt: null }], currentVersionsByActivityId: new Map([["a-1", version]]) });
    expect(columns.find((column) => column.key === "lm-1")?.activityVersionIds).toEqual(["av-1"]);
    expect(buildTopicFlow({ columns, activities: [{ id: "a-1", courseId: "c", stableCode: "A1", currentVersionId: "av-1", archivedAt: null }], versionsByActivityId: new Map([["a-1", version]]), actionsByActivityVersionId: new Map([["av-1", [{ id: "action-1", activityVersionId: "av-1", topicVersionId: "tv-1", action: "introduced", notes: null, provenance: null, siblings: [] }]]]) }).get("tv-1")?.[0]?.columnKey).toBe("lm-1");
  });
});

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

describe("buildTermDailyDriver", () => {
  it("keys both functions on the UTC calendar date", () => {
    const meeting = {
      id: "ta-midnight",
      termId: "term",
      courseId: "course",
      activityId: "activity",
      plannedActivityVersionId: "av",
      activityTypeVersionId: "type",
      adoptedLabel: "Lecture",
      termLearningModuleId: null,
      ordinal: null,
      lifecycleState: null,
      plannedRevisionId: "revision-midnight",
      deliveredRevisionId: null,
      archivedAt: null,
    };
    const revision = {
      id: "revision-midnight",
      termActivityId: meeting.id,
      revision: 1,
      baseActivityVersionId: "av",
      title: "Late meeting",
      summary: null,
      changeReason: null,
      createdByInstructorId: null,
      createdAt: "2026-02-01T00:00:00Z",
      detail: {
        behaviorFamily: "meeting" as const,
        calendarSlotId: "slot-midnight",
        startsAt: "2026-02-10T23:30:00Z",
        endsAt: null,
        status: "scheduled",
        modality: null,
        overrideReason: null,
        overrideEvidence: null,
      },
      topicActions: [],
      milestones: [],
    };
    const driver = buildTermDailyDriver({
      termActivities: [meeting],
      revisionsByTermActivityId: { [meeting.id]: { planned: revision, delivered: null } },
      today: "2026-02-10",
    });
    const timeline = buildTermCalendarTimeline({
      calendarSlots: [{
        id: "slot-midnight",
        termId: "term",
        academicCalendarEventId: null,
        date: "2026-02-10",
        slotType: "class_day",
        label: null,
        source: null,
        instructionalCapacity: "normal",
        capacitySource: "baseline",
        capacityReason: null,
      }],
      sessions: [],
      today: "2026-02-10",
    });
    expect(driver.nextMeeting?.activity.id).toBe(meeting.id);
    expect(timeline.windowRows[0]?.isToday).toBe(true);
  });

  it("leads with the next active meeting, its topics, milestone, and delivery delta", () => {
    const meeting = {
      id: "ta-1",
      termId: "term",
      courseId: "course",
      activityId: "activity",
      plannedActivityVersionId: "av",
      activityTypeVersionId: "type",
      adoptedLabel: "Lecture",
      termLearningModuleId: "tlm-1",
      ordinal: 7,
      lifecycleState: null,
      plannedRevisionId: "plan-1",
      deliveredRevisionId: "del-2",
      archivedAt: null,
    };
    const planned = {
      id: "plan-1",
      termActivityId: "ta-1",
      revision: 1,
      baseActivityVersionId: "av",
      title: "Probability",
      summary: null,
      changeReason: null,
      createdByInstructorId: null,
      createdAt: "2026-02-01T00:00:00Z",
      detail: {
        behaviorFamily: "meeting" as const,
        calendarSlotId: "slot",
        startsAt: "2026-02-10T14:00:00Z",
        endsAt: null,
        status: "scheduled",
        modality: null,
        overrideReason: null,
        overrideEvidence: null,
      },
      topicActions: [],
      milestones: [],
    };
    const delivered = {
      ...planned,
      id: "del-2",
      revision: 2,
      topicActions: [
        {
          id: "action",
          termActivityRevisionId: "del-2",
          topicVersionId: "topic-1",
          action: "practiced" as const,
          notes: null,
          provenance: null,
        },
      ],
      milestones: [
        {
          id: "milestone",
          termActivityRevisionId: "del-2",
          sourceTemplateId: null,
          role: "due" as const,
          label: "Problem set due",
          linkedTermActivityId: "ta-1",
          occursAt: "2026-02-11T23:00:00Z",
          timeZone: "UTC",
          anchorPolicy: "fixed_instant" as const,
          notes: null,
          provenance: null,
        },
        {
          id: "milestone-duplicate",
          termActivityRevisionId: "del-2",
          sourceTemplateId: null,
          role: "due" as const,
          label: "Problem set due",
          linkedTermActivityId: "ta-1",
          occursAt: "2026-02-11T23:00:00Z",
          timeZone: "UTC",
          anchorPolicy: "fixed_instant" as const,
          notes: null,
          provenance: null,
        },
      ],
    };
    const driver = buildTermDailyDriver({
      termActivities: [meeting],
      revisionsByTermActivityId: { "ta-1": { planned, delivered } },
      today: "2026-02-09",
    });
    expect(driver.nextMeeting?.activity.ordinal).toBe(7);
    expect(driver.nextMilestone?.label).toBe("Problem set due");
    expect(driver.nextMilestone?.milestoneIndex).toBe(0);
    expect(driver.activeTopicVersionIds).toEqual(["topic-1"]);
    expect(driver.changedActivityIds).toEqual(["ta-1"]);
  });

  it("numbers meetings chronologically, independently of nullable placement ordinals and interleaved activity kinds", () => {
    const meeting = (
      id: string,
      startsAt: string,
      ordinal: number | null,
      behaviorFamily: "meeting" | "coursework" = "meeting",
    ) => ({
      id,
      termId: "term",
      courseId: "course",
      activityId: id,
      plannedActivityVersionId: "av",
      activityTypeVersionId: "type",
      adoptedLabel: id,
      termLearningModuleId: null,
      ordinal,
      lifecycleState: null,
      plannedRevisionId: `revision-${id}`,
      deliveredRevisionId: null,
      archivedAt: null,
      revision: {
        id: `revision-${id}`,
        termActivityId: id,
        revision: 1,
        baseActivityVersionId: "av",
        title: id,
        summary: null,
        changeReason: null,
        createdByInstructorId: null,
        createdAt: "2026-02-01T00:00:00Z",
        detail:
          behaviorFamily === "meeting"
            ? {
                behaviorFamily,
                calendarSlotId: null,
                startsAt,
                endsAt: null,
                status: "scheduled",
                modality: null,
                overrideReason: null,
                overrideEvidence: null,
              }
            : { behaviorFamily, lifecycleState: null, deliveryNotes: null },
        topicActions: [],
        milestones: [],
      },
    });
    const first = meeting("first", "2026-02-10T09:00:00Z", null);
    const coursework = meeting("coursework", "", 0, "coursework");
    const second = meeting("second", "2026-02-11T09:00:00Z", 99);
    const driver = buildTermDailyDriver({
      termActivities: [second, coursework, first].map((candidate) => ({
        id: candidate.id,
        termId: candidate.termId,
        courseId: candidate.courseId,
        activityId: candidate.activityId,
        plannedActivityVersionId: candidate.plannedActivityVersionId,
        activityTypeVersionId: candidate.activityTypeVersionId,
        adoptedLabel: candidate.adoptedLabel,
        termLearningModuleId: candidate.termLearningModuleId,
        ordinal: candidate.ordinal,
        lifecycleState: candidate.lifecycleState,
        plannedRevisionId: candidate.plannedRevisionId,
        deliveredRevisionId: candidate.deliveredRevisionId,
        archivedAt: candidate.archivedAt,
      })),
      revisionsByTermActivityId: Object.fromEntries(
        [first, coursework, second].map(({ id, revision }) => [
          id,
          { planned: revision, delivered: null },
        ]),
      ),
      today: "2026-02-11",
    });
    expect(driver.nextMeeting?.activity.id).toBe("second");
    expect(driver.nextMeeting?.meetingOrdinal).toBe(2);
    expect(driver.totalMeetings).toBe(2);
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
        {
          id: "slot-finals",
          termId: "term-1",
          academicCalendarEventId: "event-finals",
          date: "2026-05-12",
          slotType: "finals",
          label: "Final examination period",
          source: "academic_calendar",
          instructionalCapacity: "assessment_period",
          capacitySource: "heuristic",
          capacityReason: "Finals are an alternate schedule.",
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
    expect(gaps.unplannedSpecialScheduleSlots.map((slot) => slot.id)).toEqual(["slot-finals"]);
  });

  it("does not report a finals slot as unplanned once an active session covers its date", () => {
    const gaps = deriveTermPlanningGaps({
      calendarSlots: [
        {
          id: "slot-finals",
          termId: "term-1",
          academicCalendarEventId: "event-finals",
          date: "2026-05-12",
          slotType: "finals",
          label: "Final examination period",
          source: "academic_calendar",
          instructionalCapacity: "assessment_period",
          capacitySource: "heuristic",
          capacityReason: "Finals are an alternate schedule.",
        },
      ],
      sessions: [
        {
          id: "sess-final",
          termId: "term-1",
          termLearningModuleId: "tlm-1",
          calendarSlotId: "slot-finals",
          sequence: 1,
          sessionType: "lecture",
          code: "F01",
          title: "Final exam",
          date: "2026-05-12",
          scheduleOverrideLabel: "Alternate finals schedule",
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

    expect(gaps.unplannedSpecialScheduleSlots).toEqual([]);
    expect(gaps.unplannedClassDays).toEqual([]);
  });

  it("treats a targeted Term calendar modification as an explicit alternate schedule", () => {
    const gaps = deriveTermPlanningGaps({
      calendarSlots: [{ id: "slot-finals", termId: "term-1", academicCalendarEventId: "event-finals", date: "2026-05-12", slotType: "finals", label: "Final examination period", source: "academic_calendar", instructionalCapacity: "assessment_period", capacitySource: "heuristic", capacityReason: "Finals are an alternate schedule." }],
      sessions: [],
      exceptions: [{ id: "exception-1", termId: "term-1", action: "modify", activityTypeVersionId: null, calendarSlotId: "slot-finals", targetDate: "2026-05-12", startsAt: null, endsAt: null, label: "Alternate final", reason: "Instructor-approved alternate schedule.", provenance: null }],
    });

    expect(gaps.unplannedSpecialScheduleSlots).toEqual([]);
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

  it("labels inherited and Term-specific calendar provenance", () => {
    const timeline = buildTermCalendarTimeline({
      calendarSlots: [
        { id: "inherited", termId: "term-1", academicCalendarEventId: "event-1", date: "2026-03-01", slotType: "class_day", label: null, source: "academic_calendar", instructionalCapacity: "normal", capacitySource: "baseline", capacityReason: null },
        { id: "specific", termId: "term-1", academicCalendarEventId: "event-2", date: "2026-03-02", slotType: "class_day", label: null, source: "academic_calendar", instructionalCapacity: "normal", capacitySource: "instructor_override", capacityReason: "Makeup." },
      ], sessions: [], today: "2026-03-01",
    });

    expect(timeline.allRows.map((row) => row.provenance)).toEqual(["calendar_inherited", "term_specific"]);
  });

  it("labels an inherited slot Term-specific once a targeted modify exception exists", () => {
    const inheritedSlot = { id: "inherited", termId: "term-1", academicCalendarEventId: "event-1", date: "2026-03-01", slotType: "class_day" as const, label: null, source: "academic_calendar", instructionalCapacity: "normal" as const, capacitySource: "baseline" as const, capacityReason: null };
    const exception = { id: "exception-1", termId: "term-1", action: "modify" as const, activityTypeVersionId: null, calendarSlotId: "inherited", targetDate: null, startsAt: null, endsAt: null, label: "Room change", reason: "Term-specific override.", provenance: null };

    const withException = buildTermCalendarTimeline({
      calendarSlots: [inheritedSlot], sessions: [], today: "2026-03-01", exceptions: [exception],
    });
    expect(withException.allRows[0]?.provenance).toBe("term_specific");

    const dateOnly = buildTermCalendarTimeline({
      calendarSlots: [inheritedSlot], sessions: [], today: "2026-03-01",
      exceptions: [{ ...exception, calendarSlotId: null, targetDate: "2026-03-01" }],
    });
    expect(dateOnly.allRows[0]?.provenance).toBe("term_specific");

    const cancelOnly = buildTermCalendarTimeline({
      calendarSlots: [inheritedSlot], sessions: [], today: "2026-03-01",
      exceptions: [{ ...exception, action: "cancel" as const }],
    });
    expect(cancelOnly.allRows[0]?.provenance).toBe("calendar_inherited");

    const withoutException = buildTermCalendarTimeline({
      calendarSlots: [inheritedSlot], sessions: [], today: "2026-03-01", exceptions: [],
    });
    expect(withoutException.allRows[0]?.provenance).toBe("calendar_inherited");
  });
});

describe("suggestTopicStableCode", () => {
  it("builds a stable topic slug from the title", () => {
    expect(suggestTopicStableCode("Pandas Basics")).toBe("topic-pandas-basics");
    expect(suggestTopicStableCode("SQL joins & null handling")).toBe(
      "topic-sql-joins-null-handling",
    );
  });
});
