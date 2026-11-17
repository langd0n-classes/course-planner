import { describe, expect, it } from "vitest";
import type {
  TermActivityDto,
  TermActivityRevisionDto,
  TermActivityMilestoneDto,
} from "./redesign-contract";
import { checkTermOrder, type CheckTermOrderArgs } from "./term-order-checks";

function meeting(
  id: string,
  date: string | null,
  action = "introduced",
  topicVersionId = "tv",
) {
  const activity: TermActivityDto = {
    id,
    termId: "term",
    courseId: "course",
    activityId: id,
    plannedActivityVersionId: id,
    activityTypeVersionId: "type",
    adoptedLabel: id,
    termLearningModuleId: null,
    ordinal: null,
    lifecycleState: null,
    plannedRevisionId: id,
    deliveredRevisionId: null,
    archivedAt: null,
  };
  const revision: TermActivityRevisionDto = {
    id,
    termActivityId: id,
    revision: 1,
    baseActivityVersionId: id,
    title: id,
    summary: null,
    changeReason: null,
    createdByInstructorId: null,
    createdAt: "2026-01-01",
    detail: {
      behaviorFamily: "meeting",
      startsAt: date,
      endsAt: null,
      calendarSlotId: null,
      status: null,
      modality: null,
      overrideReason: null,
      overrideEvidence: null,
    },
    topicActions: [
      {
        id,
        termActivityRevisionId: id,
        topicVersionId,
        action: action as "introduced",
        notes: null,
        provenance: null,
      },
    ],
    milestones: [],
  };
  return { activity, revision };
}
function args(...entries: ReturnType<typeof meeting>[]): CheckTermOrderArgs {
  return {
    termActivities: entries.map((e) => e.activity),
    revisionsByTermActivityId: Object.fromEntries(
      entries.map((e) => [
        e.activity.id,
        { planned: e.revision, delivered: null },
      ]),
    ),
    topicVersions: [
      { id: "tv", topicId: "topic" },
      { id: "pv", topicId: "prereq" },
    ],
    prerequisites: [],
    calendarSlots: [],
  };
}
function milestone(
  date: string | null,
  role: "due" | "release" = "due",
): TermActivityMilestoneDto {
  return {
    id: "milestone",
    termActivityRevisionId: "work",
    sourceTemplateId: null,
    role,
    label: role,
    linkedTermActivityId: null,
    occursAt: date,
    timeZone: null,
    anchorPolicy: "standalone",
    notes: null,
    provenance: null,
  };
}

describe("checkTermOrder", () => {
  it.each([
    ["assessed", "assessed_before_introduced"],
    ["practiced", "practiced_before_introduced"],
  ])("reports %s before introduction in a planned Term", (action, kind) => {
    const result = checkTermOrder(
      args(
        meeting("intro", "2026-02-02", "introduced"),
        meeting("early", "2026-02-01", action),
      ),
    );
    expect(result.findings).toEqual([
      expect.objectContaining({
        kind,
        topicId: "topic",
        termActivityIds: ["early", "intro"],
        dates: ["2026-02-01", "2026-02-02"],
      }),
    ]);
  });
  it("reports a Topic never introduced once, even with Practice and Assess", () => {
    expect(
      checkTermOrder(
        args(
          meeting("p", "2026-02-01", "practiced"),
          meeting("a", "2026-02-02", "assessed"),
        ),
      ).findings,
    ).toEqual([
      expect.objectContaining({
        kind: "never_introduced",
        termActivityIds: ["p", null],
        dates: ["2026-02-01", null],
      }),
    ]);
  });
  it("compares prerequisite introductions across Topic versions", () => {
    const input = args(
      meeting("dependent", "2026-02-01"),
      meeting("foundation", "2026-02-03", "introduced", "pv"),
    );
    input.prerequisites = [{ topicId: "topic", prerequisiteTopicId: "prereq" }];
    expect(checkTermOrder(input).findings[0]?.kind).toBe(
      "prerequisite_after_dependent",
    );
  });
  it("uses delivered dates and checks a due milestone against its linked meeting", () => {
    const intro = meeting("intro", "2026-02-01");
    const work = meeting("work", null, "assessed");
    work.revision.detail = {
      behaviorFamily: "assessment",
      lifecycleState: null,
      modality: null,
      deliveryNotes: null,
    };
    work.revision.milestones = [
      { ...milestone("2026-02-02"), linkedTermActivityId: "intro" },
      milestone("2026-02-10", "release"),
    ];
    const input = args(intro, work);
    expect(checkTermOrder(input).findings).toEqual([]);
    input.revisionsByTermActivityId.intro.delivered = {
      ...intro.revision,
      detail: {
        ...intro.revision.detail,
        behaviorFamily: "meeting",
        startsAt: "2026-02-03",
        calendarSlotId: null,
        endsAt: null,
        status: null,
        modality: null,
        overrideReason: null,
        overrideEvidence: null,
      },
    };
    expect(checkTermOrder(input).findings.map((f) => f.kind)).toEqual([
      "due_before_linked_meeting",
      "assessed_before_introduced",
    ]);
  });
  it("reports a planned due milestone before its linked meeting without Topic actions", () => {
    const linked = meeting("linked", "2026-02-03");
    const work = meeting("work", null);
    linked.revision.topicActions = [];
    work.revision.topicActions = [];
    work.revision.detail = {
      behaviorFamily: "coursework",
      lifecycleState: null,
      deliveryNotes: null,
    };
    work.revision.milestones = [
      { ...milestone("2026-02-01"), linkedTermActivityId: "linked" },
    ];
    expect(checkTermOrder(args(linked, work)).findings).toEqual([
      expect.objectContaining({
        kind: "due_before_linked_meeting",
        topicId: null,
        termActivityIds: ["work", "linked"],
        dates: ["2026-02-01", "2026-02-03"],
      }),
    ]);
  });
  it("lists an undated Activity and milestone without findings", () => {
    const entry = meeting("missing", null, "practiced");
    entry.revision.milestones = [milestone(null)];
    const result = checkTermOrder(args(entry));
    expect(result.findings).toEqual([]);
    expect(result.undated.count).toBe(2);
    expect(result.undated.items[0].termActivityId).toBe("missing");
  });
  it("ignores canceled Activities and their milestones", () => {
    const entry = meeting("canceled", null, "assessed");
    if (entry.revision.detail.behaviorFamily === "meeting")
      entry.revision.detail.status = "canceled";
    entry.revision.milestones = [milestone(null)];
    expect(checkTermOrder(args(entry))).toEqual({
      findings: [],
      unmappedActionCount: 0,
      undated: { count: 0, items: [] },
    });
  });
  it("accepts correct and same-day order regardless of time", () => {
    expect(
      checkTermOrder(
        args(
          meeting("i", "2026-02-01T18:00:00Z"),
          meeting("p", "2026-02-01T08:00:00Z", "practiced"),
          meeting("a", "2026-02-02", "assessed"),
        ),
      ).findings,
    ).toEqual([]);
  });
  it("falls back to Calendar Slots and the latest dated milestone", () => {
    const intro = meeting("i", null);
    if (intro.revision.detail.behaviorFamily === "meeting")
      intro.revision.detail.calendarSlotId = "slot";
    const work = meeting("work", null, "assessed");
    work.revision.detail = {
      behaviorFamily: "coursework",
      lifecycleState: null,
      deliveryNotes: null,
    };
    work.revision.milestones = [milestone("2026-02-01", "release")];
    const input = args(intro, work);
    input.calendarSlots = [{ id: "slot", date: "2026-02-02" }];
    expect(checkTermOrder(input).findings[0]?.kind).toBe(
      "assessed_before_introduced",
    );
  });
  it("does not call an undated introduction absent, and uses stable Topic identity", () => {
    const input = args(
      meeting("i", null),
      meeting("p", "2026-02-01", "practiced", "tv2"),
    );
    input.topicVersions.push({ id: "tv2", topicId: "topic" });
    expect(checkTermOrder(input).findings).toEqual([]);
  });
  it("sorts by later date then Topic and compares only earliest actions", () => {
    const input = args(
      meeting("i", "2026-02-04"),
      meeting("p", "2026-02-01", "practiced"),
      meeting("p2", "2026-02-02", "practiced"),
      meeting("pi", "2026-02-03", "introduced", "pv"),
      meeting("pa", "2026-02-01", "assessed", "pv"),
    );
    expect(checkTermOrder(input).findings.map((f) => f.topicId)).toEqual([
      "prereq",
      "topic",
    ]);
  });
});

describe("local dates and Topic names", () => {
  it("compares an instant by its local date in the Term time zone", () => {
    // 2026-03-06T01:00Z is the evening of March 5 in New York.
    const assess = meeting("assess", "2026-03-06T01:00:00.000Z", "assessed");
    const intro = meeting("intro", "2026-03-05T15:00:00.000Z");
    const input = args(assess, intro);
    expect(
      checkTermOrder({ ...input, timeZone: "America/New_York" }).findings,
    ).toEqual([]);
    expect(checkTermOrder(input).findings.map((f) => f.kind)).toEqual([]);
    const later = meeting("intro", "2026-03-06T15:00:00.000Z");
    const result = checkTermOrder({
      ...args(assess, later),
      timeZone: "America/New_York",
    });
    expect(result.findings.map((f) => f.kind)).toEqual([
      "assessed_before_introduced",
    ]);
    expect(result.findings[0].dates).toEqual(["2026-03-05", "2026-03-06"]);
  });
  it("uses the instant before the slot date", () => {
    const assess = meeting("assess", "2026-03-06T01:00:00.000Z", "assessed");
    if (assess.revision.detail.behaviorFamily === "meeting")
      assess.revision.detail.calendarSlotId = "slot";
    const intro = meeting("intro", "2026-03-06T15:00:00.000Z");
    const result = checkTermOrder({
      ...args(assess, intro),
      calendarSlots: [{ id: "slot", date: "2026-03-05" }],
    });
    expect(result.findings).toEqual([]);
  });
  it("names the Topic in the sentence", () => {
    const assess = meeting("assess", "2026-03-02", "assessed");
    const intro = meeting("intro", "2026-03-04");
    const input = args(assess, intro);
    expect(
      checkTermOrder({ ...input, topicLabels: { topic: "Recursion" } })
        .findings[0].sentence,
    ).toBe("Recursion is assessed before it is introduced.");
    expect(checkTermOrder(input).findings[0].sentence).toBe(
      "A Topic is assessed before it is introduced.",
    );
  });
});

describe("review regressions", () => {
  it.each(["assessed", "practiced"])(
    "does not order %s against a possibly earlier undated Introduce",
    (action) => {
      expect(
        checkTermOrder(
          args(
            meeting("unknown", null),
            meeting("intro", "2026-02-04"),
            meeting("early", "2026-02-01", action),
          ),
        ).findings,
      ).toEqual([]);
    },
  );
  it.each(["tv", "pv"])(
    "skips prerequisite pairs with undated Introduce %s",
    (version) => {
      const input = args(
        meeting("dep", "2026-02-01"),
        meeting("pre", "2026-02-04", "introduced", "pv"),
        meeting("unknown", null, "introduced", version),
      );
      input.prerequisites = [
        { topicId: "topic", prerequisiteTopicId: "prereq" },
      ];
      expect(checkTermOrder(input).findings).toEqual([]);
    },
  );
  it("uses a delivered startsAt even when the old slot remains", () => {
    const intro = meeting("intro", "2026-02-01");
    const input = args(intro, meeting("practice", "2026-02-02", "practiced"));
    input.calendarSlots = [{ id: "old", date: "2026-02-01" }];
    input.revisionsByTermActivityId.intro.delivered = {
      ...intro.revision,
      detail: {
        ...intro.revision.detail,
        behaviorFamily: "meeting",
        calendarSlotId: "old",
        startsAt: "2026-02-03",
        endsAt: null,
        status: null,
        modality: null,
        overrideReason: null,
        overrideEvidence: null,
      },
    };
    expect(checkTermOrder(input).findings[0].dates).toEqual([
      "2026-02-02",
      "2026-02-03",
    ]);
  });
  it.each([undefined, "Invalid/Zone"])(
    "uses UTC for offset instants with zone %s",
    (timeZone) => {
      const input = args(
        meeting("intro", "2026-03-06"),
        meeting("early", "2026-03-06T00:30:00+03:00", "assessed"),
      );
      expect(checkTermOrder({ ...input, timeZone }).findings[0].dates).toEqual([
        "2026-03-05",
        "2026-03-06",
      ]);
    },
  );
  it.each([
    "2026-03-08T06:30:00Z",
    "2026-03-08T07:30:00Z",
    "2026-11-01T05:30:00Z",
    "2026-11-01T06:30:00Z",
  ])("formats local dates across DST: %s", (instant) => {
    const result = checkTermOrder({
      ...args(
        meeting("early", instant, "practiced"),
        meeting("intro", "2026-12-01"),
      ),
      timeZone: "America/New_York",
    });
    expect(result.findings[0].dates[0]).toBe(instant.slice(0, 10));
  });
  it("falls back from an invalid milestone zone to the Term zone", () => {
    const work = meeting("work", null, "assessed");
    work.revision.detail = {
      behaviorFamily: "coursework",
      lifecycleState: null,
      deliveryNotes: null,
    };
    work.revision.milestones = [
      { ...milestone("2026-03-06T01:00:00Z"), timeZone: "Invalid/Zone" },
    ];
    expect(
      checkTermOrder({
        ...args(work, meeting("intro", "2026-03-06")),
        timeZone: "America/New_York",
      }).findings[0].dates[0],
    ).toBe("2026-03-05");
  });
  it("keeps invalid instants and short date values as written", () => {
    for (const value of ["2026-02-01invalid", "2026-02-01"]) {
      expect(
        checkTermOrder(
          args(meeting("p", value, "practiced"), meeting("i", "2026-02-02")),
        ).findings[0].dates[0],
      ).toBe("2026-02-01");
    }
  });
  it("sorts equal-date findings and produces identical results for reversed arrays", () => {
    const input = args(
      meeting("intro", "2026-02-04"),
      meeting("p", "2026-02-01", "practiced"),
      meeting("a", "2026-02-01", "assessed"),
      meeting("unknown", null, "practiced", "pv"),
    );
    const result = checkTermOrder(input);
    expect(result.findings.map((f) => f.kind)).toEqual([
      "assessed_before_introduced",
      "practiced_before_introduced",
    ]);
    expect(
      checkTermOrder({
        ...input,
        termActivities: [...input.termActivities].reverse(),
        topicVersions: [...input.topicVersions].reverse(),
        prerequisites: [...input.prerequisites].reverse(),
        calendarSlots: [...input.calendarSlots].reverse(),
      }),
    ).toEqual(result);
  });
  it.each(["cancelled", "Canceled", "CANCELLED"])(
    "ignores %s introductions leaving never_introduced",
    (status) => {
      const intro = meeting("intro", "2026-02-01");
      if (intro.revision.detail.behaviorFamily === "meeting")
        intro.revision.detail.status = status;
      expect(
        checkTermOrder(args(intro, meeting("p", "2026-02-02", "practiced")))
          .findings[0].kind,
      ).toBe("never_introduced");
    },
  );
  it("ignores archived Activities including undated milestones", () => {
    const archived = meeting("archived", null);
    archived.activity.archivedAt = "2026-02-01";
    archived.revision.milestones = [milestone(null)];
    expect(checkTermOrder(args(archived)).undated.count).toBe(0);
  });
  it("counts every unmapped action", () => {
    const entry = meeting("unknown", "2026-02-01", "assessed", "missing");
    entry.revision.topicActions.push({
      ...entry.revision.topicActions[0],
      id: "second",
    });
    expect(checkTermOrder(args(entry))).toEqual({
      findings: [],
      undated: { count: 0, items: [] },
      unmappedActionCount: 2,
    });
  });
});
