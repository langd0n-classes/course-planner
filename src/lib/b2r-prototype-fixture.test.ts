import { describe, expect, it } from "vitest";
import {
  buildFixture,
  getDuplicateTopicActions,
  getUpcomingItems,
  suggestTopicCode,
} from "./b2r-prototype-fixture";

describe("fixture scale", () => {
  const fixture = buildFixture();

  it("has ~150 topics", () => {
    expect(fixture.topics.length).toBeGreaterThanOrEqual(140);
    expect(fixture.topics.length).toBeLessThanOrEqual(160);
  });

  it("has at least 7 learning modules", () => {
    expect(fixture.learningModules.length).toBeGreaterThanOrEqual(7);
  });

  it("has at least 18 meeting activities", () => {
    const meetings = fixture.activities.filter((a) => a.kind === "meeting");
    expect(meetings.length).toBeGreaterThanOrEqual(18);
  });

  it("has at least one project with multiple milestones", () => {
    const projects = fixture.activities.filter((a) => a.kind === "project");
    expect(projects.length).toBeGreaterThanOrEqual(1);
    const multiMilestone = projects.filter((p) => p.milestones.length >= 3);
    expect(multiMilestone.length).toBeGreaterThanOrEqual(1);
  });

  it("has at least one cross-cutting activity (no primaryLmId)", () => {
    const crossCutting = fixture.activities.filter((a) => a.primaryLmId === null);
    expect(crossCutting.length).toBeGreaterThanOrEqual(1);
  });
});

describe("one-primary-LM invariant", () => {
  const fixture = buildFixture();

  it("every activity has at most one primaryLmId (string or null)", () => {
    for (const act of fixture.activities) {
      const val = act.primaryLmId;
      expect(val === null || typeof val === "string").toBe(true);
    }
  });

  it("all primaryLmIds reference valid LM ids", () => {
    const lmIds = new Set(fixture.learningModules.map((lm) => lm.id));
    for (const act of fixture.activities) {
      if (act.primaryLmId !== null) {
        expect(lmIds.has(act.primaryLmId), `Activity ${act.id} references unknown LM ${act.primaryLmId}`).toBe(true);
      }
    }
  });

  it("all topicActions reference valid activity and topic ids", () => {
    const actIds = new Set(fixture.activities.map((a) => a.id));
    const topicIds = new Set(fixture.topics.map((t) => t.id));
    for (const ta of fixture.topicActions) {
      expect(actIds.has(ta.activityId), `TopicAction ${ta.id} references unknown activity ${ta.activityId}`).toBe(true);
      expect(topicIds.has(ta.topicId), `TopicAction ${ta.id} references unknown topic ${ta.topicId}`).toBe(true);
    }
  });
});

describe("duplicate I/P/A warning", () => {
  const fixture = buildFixture();

  it("detects the intentional duplicate topic action", () => {
    const dupes = getDuplicateTopicActions(fixture.topicActions);
    expect(dupes.size).toBeGreaterThanOrEqual(1);
  });

  it("duplicate is Data Types topic with I action", () => {
    const dupes = getDuplicateTopicActions(fixture.topicActions);
    const dataTypesTopic = fixture.topics.find((t) => t.title === "Data Types and Structures");
    expect(dataTypesTopic).toBeDefined();
    const key = `${dataTypesTopic!.id}:I`;
    const dupeList = dupes.get(key);
    expect(dupeList).toBeDefined();
    expect(dupeList!.length).toBeGreaterThanOrEqual(2);
  });

  it("duplicate actions reference distinct activities", () => {
    const dupes = getDuplicateTopicActions(fixture.topicActions);
    for (const [, list] of dupes) {
      const actIds = list.map((ta) => ta.activityId);
      const unique = new Set(actIds);
      expect(unique.size).toBe(actIds.length);
    }
  });
});

describe("topic code suggestion", () => {
  it("suggests initials for multi-word titles", () => {
    expect(suggestTopicCode("Central Limit Theorem")).toBe("CLT");
    expect(suggestTopicCode("Singular Value Decomposition")).toBe("SVD");
  });

  it("handles stop words", () => {
    expect(suggestTopicCode("Law of Large Numbers")).toBe("LLN");
  });

  it("handles single-word titles with truncation", () => {
    const code = suggestTopicCode("Matrices");
    expect(code).toBe("MATR");
  });
});

describe("upcoming items", () => {
  const fixture = buildFixture();

  it("returns items after currentDate", () => {
    const items = getUpcomingItems(fixture.activities, fixture.currentDate, 20);
    for (const item of items) {
      expect(item.date >= fixture.currentDate).toBe(true);
    }
  });

  it("returns meetings and milestones mixed", () => {
    const items = getUpcomingItems(fixture.activities, "2026-01-20", 20);
    const hasMeetings = items.some((i) => i.type === "meeting");
    const hasMilestones = items.some((i) => i.type === "milestone");
    expect(hasMeetings).toBe(true);
    expect(hasMilestones).toBe(true);
  });

  it("is sorted ascending by date", () => {
    const items = getUpcomingItems(fixture.activities, "2026-01-20", 20);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].date >= items[i - 1].date).toBe(true);
    }
  });
});

describe("semantic coverage at currentDate", () => {
  const fixture = buildFixture();

  it("latest meeting exists and has primary learning module", () => {
    const upcoming = getUpcomingItems(fixture.activities, fixture.currentDate, 30);
    const nextMeeting = upcoming.find((i) => i.type === "meeting");
    expect(nextMeeting).toBeDefined();
    const activity = fixture.activities.find((a) => a.id === nextMeeting!.activityId);
    expect(activity).toBeDefined();
    expect(activity!.primaryLmId).not.toBeNull();
    expect(fixture.learningModules.some((lm) => lm.id === activity!.primaryLmId)).toBe(true);
  });

  it("next meeting exists and has topic-action assignments", () => {
    const upcoming = getUpcomingItems(fixture.activities, fixture.currentDate, 30);
    const nextMeeting = upcoming.find((i) => i.type === "meeting");
    expect(nextMeeting).toBeDefined();
    const topicActionsForMeeting = fixture.topicActions.filter((ta) => ta.activityId === nextMeeting!.activityId);
    expect(topicActionsForMeeting.length).toBeGreaterThanOrEqual(1);
  });

  it("at least one future milestone exists with resolvable real date", () => {
    const upcoming = getUpcomingItems(fixture.activities, fixture.currentDate, 50);
    const milestones = upcoming.filter((i) => i.type === "milestone");
    expect(milestones.length).toBeGreaterThanOrEqual(1);
    for (const ms of milestones) {
      expect(ms.date).toBeDefined();
      expect(ms.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ms.date >= fixture.currentDate).toBe(true);
    }
  });

  it("every milestone resolves from linked activity date or explicit date, never fallback", () => {
    const upcomingItems = getUpcomingItems(fixture.activities, fixture.currentDate, 50);
    for (const item of upcomingItems) {
      if (item.type === "milestone") {
        const activity = fixture.activities.find((a) => a.id === item.activityId);
        expect(activity).toBeDefined();
        const milestone = activity!.milestones.find((m) => m.label === item.label);
        expect(milestone).toBeDefined();
        if (milestone!.linkedActivityId) {
          const linkedAct = fixture.activities.find((a) => a.id === milestone!.linkedActivityId);
          expect(linkedAct?.date).toBeDefined();
          expect(linkedAct?.date).toBe(item.date);
        } else {
          expect(milestone!.date).toBeDefined();
          expect(milestone!.date).toBe(item.date);
        }
      }
    }
  });

  it("preserves the project 1 exact morning time only on the explicit due milestone", () => {
    const project = fixture.activities.find((a) => a.id === "proj01");
    expect(project).toBeDefined();

    const dueMilestone = project!.milestones.find((m) => m.id === "proj01-due");
    expect(dueMilestone).toMatchObject({
      linkedActivityId: null,
      date: "2026-03-26",
      time: "09:00",
    });

    const upcomingItems = getUpcomingItems(fixture.activities, fixture.currentDate, 50);
    const dueItem = upcomingItems.find((item) => item.activityId === "proj01" && item.label === "Due before L18");
    expect(dueItem).toMatchObject({
      type: "milestone",
      date: "2026-03-26",
      time: "09:00",
    });

    const releasedItem = upcomingItems.find((item) => item.activityId === "proj01" && item.label === "Released during L11");
    expect(releasedItem?.time).toBeUndefined();
  });

  it("maintains existing topic/module/duplicate-action/project invariants", () => {
    const actIds = new Set(fixture.activities.map((a) => a.id));
    const topicIds = new Set(fixture.topics.map((t) => t.id));
    for (const ta of fixture.topicActions) {
      expect(actIds.has(ta.activityId)).toBe(true);
      expect(topicIds.has(ta.topicId)).toBe(true);
    }
    const dupes = getDuplicateTopicActions(fixture.topicActions);
    expect(dupes.size).toBeGreaterThanOrEqual(1);
    const projects = fixture.activities.filter((a) => a.kind === "project");
    expect(projects.length).toBeGreaterThanOrEqual(1);
    const multiMs = projects.filter((p) => p.milestones.length >= 3);
    expect(multiMs.length).toBeGreaterThanOrEqual(1);
  });
});
