import { describe, expect, it } from "vitest";
import {
  planMeetingPlacement,
  type MeetingPlacementInput,
} from "./meeting-placement";
import { DomainInvariantError } from "./errors";

const time = {
  startTimeLocal: "09:00",
  endTimeLocal: null,
  timeZone: "America/New_York",
};
const meeting = (id: string, sequence: number | null = 1) => ({
  termActivityId: id,
  activityTypeVersionId: "type",
  termLearningModuleSequence: sequence as number | null,
  ordinal: 1 as number | null,
  createdAt: "2026-01-01T00:00:00Z",
  plannedRevisionId: `r-${id}`,
  calendarSlotId: null as string | null,
  startsAt: null as string | null,
  status: null as string | null,
  defaultDurationMinutes: 50,
});
const slot = (date: string, slotType = "class_day") => ({
  id: date,
  date,
  slotType,
});
const input = (
  overrides: Partial<MeetingPlacementInput> = {},
): MeetingPlacementInput => ({
  meetings: [meeting("a"), meeting("b")],
  slots: [slot("2026-03-06"), slot("2026-03-09")],
  patterns: [],
  cancelExceptions: [],
  defaultMeetingTime: time,
  ...overrides,
});

describe("planMeetingPlacement", () => {
  it("reports meetings beyond capacity", () => {
    const result = planMeetingPlacement(input({ slots: [slot("2026-03-06")] }));
    expect(result.placements).toHaveLength(1);
    expect(result.unplacedMeetings).toEqual([
      { termActivityId: "b", reason: "no_slot_left" },
    ]);
  });
  it("reports empty class days", () => {
    expect(
      planMeetingPlacement(input({ meetings: [meeting("a")] })).emptySlots,
    ).toEqual([{ calendarSlotId: "2026-03-09", date: "2026-03-09" }]);
  });
  it("skips a holiday between class days", () => {
    expect(
      planMeetingPlacement(
        input({
          slots: [
            slot("2026-03-06"),
            slot("2026-03-07", "holiday"),
            slot("2026-03-09"),
          ],
        }),
      ).placements.map((p) => p.date),
    ).toEqual(["2026-03-06", "2026-03-09"]);
  });
  it("removes global cancellations from placements and empty slots", () => {
    const result = planMeetingPlacement(
      input({
        cancelExceptions: [{ date: "2026-03-06", activityTypeVersionId: null }],
      }),
    );
    expect(result.placements[0].date).toBe("2026-03-09");
    expect(result.emptySlots).toEqual([]);
  });
  it("keeps dated meetings and places around their slot", () => {
    const result = planMeetingPlacement(
      input({
        meetings: [
          { ...meeting("dated"), calendarSlotId: "2026-03-06" },
          meeting("a"),
        ],
      }),
    );
    expect(result.alreadyDatedCount).toBe(1);
    expect(result.placements.map((p) => [p.termActivityId, p.date])).toEqual([
      ["a", "2026-03-09"],
    ]);
  });
  it("reserves dates using the type's local time zone", () => {
    expect(
      planMeetingPlacement(
        input({
          meetings: [
            { ...meeting("dated"), startsAt: new Date("2026-03-07T01:00:00Z") },
            meeting("a"),
          ],
        }),
      ).placements[0].date,
    ).toBe("2026-03-09");
  });
  it("uses different patterns for two meeting types", () => {
    const patterns = [
      {
        activityTypeVersionId: "lecture",
        daysOfWeek: ["friday"],
        startsOn: "2026-03-01",
        endsOn: "2026-03-31",
        ...time,
      },
      {
        activityTypeVersionId: "lab",
        daysOfWeek: ["monday"],
        startsOn: "2026-03-01",
        endsOn: "2026-03-31",
        ...time,
        startTimeLocal: "14:00",
      },
    ];
    const result = planMeetingPlacement(
      input({
        meetings: [
          meeting("a"),
          { ...meeting("b"), activityTypeVersionId: "lab" },
        ],
        patterns,
      }),
    );
    expect(
      result.placements.map((p) => [p.date, p.startsAt.toISOString()]),
    ).toEqual([
      ["2026-03-06", "2026-03-06T14:00:00.000Z"],
      ["2026-03-09", "2026-03-09T18:00:00.000Z"],
    ]);
  });
  it("requires fallback meeting time only for a type without patterns", () => {
    const result = planMeetingPlacement(input({ defaultMeetingTime: null }));
    expect(result.missingMeetingTime).toBe(true);
    expect(result.placements).toEqual([]);
  });
  it("reports missing module and ignores canceled meetings", () => {
    const result = planMeetingPlacement(
      input({
        meetings: [meeting("a", null), { ...meeting("b"), status: "canceled" }],
      }),
    );
    expect(result.unplacedMeetings).toEqual([
      { termActivityId: "a", reason: "no_learning_module" },
    ]);
    expect(result.placements).toEqual([]);
  });
  it("orders module sequence before ordinal, then null ordinals last", () => {
    const result = planMeetingPlacement(
      input({
        meetings: [
          { ...meeting("later", 2), ordinal: 1 },
          { ...meeting("first", 1), ordinal: 99 },
        ],
      }),
    );
    expect(result.placements.map((p) => p.termActivityId)).toEqual([
      "first",
      "later",
    ]);
  });
  it("converts times correctly across daylight saving", () => {
    const result = planMeetingPlacement(input());
    expect(result.placements.map((p) => p.startsAt.toISOString())).toEqual([
      "2026-03-06T14:00:00.000Z",
      "2026-03-09T13:00:00.000Z",
    ]);
    expect(result.placements[1].endsAt?.toISOString()).toBe(
      "2026-03-09T13:50:00.000Z",
    );
  });
  it.each([
    { ...time, timeZone: "invalid/zone" },
    { ...time, startTimeLocal: "9:00" },
    { ...time, endTimeLocal: "25:00" },
  ])("rejects invalid local time or zone", (defaultMeetingTime) => {
    expect(() => planMeetingPlacement(input({ defaultMeetingTime }))).toThrow(
      DomainInvariantError,
    );
  });
});

it("supports two types with different weekday patterns and type-specific cancellations", () => {
  const result = planMeetingPlacement(
    input({
      meetings: [
        meeting("a"),
        { ...meeting("b"), activityTypeVersionId: "lab" },
      ],
      slots: [slot("2026-03-06"), slot("2026-03-09"), slot("2026-03-10")],
      patterns: [
        {
          ...time,
          activityTypeVersionId: "type",
          daysOfWeek: ["friday", "monday"],
          startsOn: "2026-01-01",
          endsOn: "2026-06-01",
        },
        {
          ...time,
          startTimeLocal: "14:00",
          activityTypeVersionId: "lab",
          daysOfWeek: ["tuesday"],
          startsOn: "2026-01-01",
          endsOn: "2026-06-01",
        },
      ],
      cancelExceptions: [{ date: "2026-03-06", activityTypeVersionId: "type" }],
    }),
  );
  expect(result.placements.map((p) => [p.termActivityId, p.date])).toEqual([
    ["a", "2026-03-09"],
    ["b", "2026-03-10"],
  ]);
  expect(result.emptySlots).toEqual([
    { calendarSlotId: "2026-03-06", date: "2026-03-06" },
  ]);
});
it("asks for time when a type has no pattern or default", () => {
  const result = planMeetingPlacement(input({ defaultMeetingTime: null }));
  expect(result.missingMeetingTime).toBe(true);
  expect(result.placements).toEqual([]);
});
it("reports a meeting without a Term Learning Module", () => {
  expect(
    planMeetingPlacement(
      input({
        meetings: [{ ...meeting("a"), termLearningModuleSequence: null }],
      }),
    ).unplacedMeetings,
  ).toEqual([{ termActivityId: "a", reason: "no_learning_module" }]);
});
it("uses startsAt's local date to reserve a slot, and ignores canceled holders", () => {
  const result = planMeetingPlacement(
    input({
      meetings: [
        { ...meeting("dated"), startsAt: "2026-03-07T02:00:00Z" },
        meeting("a"),
        {
          ...meeting("canceled"),
          calendarSlotId: "2026-03-09",
          status: "canceled",
        },
      ],
    }),
  );
  expect(result.placements.map((p) => p.date)).toEqual(["2026-03-09"]);
});
it("uses local end time or a null end without duration", () => {
  expect(
    planMeetingPlacement(
      input({ defaultMeetingTime: { ...time, endTimeLocal: "10:30" } }),
    ).placements[0].endsAt?.toISOString(),
  ).toBe("2026-03-06T15:30:00.000Z");
  expect(
    planMeetingPlacement(
      input({ meetings: [{ ...meeting("a"), defaultDurationMinutes: null }] }),
    ).placements[0].endsAt,
  ).toBeNull();
});

import { buildTermDailyDriver } from "@/lib/redesign-workspace";
import type {
  TermActivityDto,
  TermActivityRevisionDto,
} from "@/lib/redesign-contract";
it("places all 40 meetings from the Term start so a part-way Term retains the next meeting's ordinal", () => {
  const meetings = Array.from({ length: 40 }, (_, i) => ({
    ...meeting(`m-${i}`, i + 1),
    ordinal: i + 1,
  }));
  const slots = meetings.map((_, i) =>
    slot(new Date(Date.UTC(2026, 0, 5 + i)).toISOString().slice(0, 10)),
  );
  const result = planMeetingPlacement(input({ meetings, slots }));
  const termActivities: TermActivityDto[] = meetings.map((m) => ({
    id: m.termActivityId,
    termId: "term",
    courseId: "course",
    activityId: m.termActivityId,
    plannedActivityVersionId: "v",
    activityTypeVersionId: "type",
    adoptedLabel: "Lecture",
    termLearningModuleId: "lm",
    ordinal: m.ordinal,
    lifecycleState: null,
    plannedRevisionId: m.plannedRevisionId,
    deliveredRevisionId: null,
    archivedAt: null,
  }));
  const revisionsByTermActivityId = Object.fromEntries(
    result.placements.map((p) => {
      const planned: TermActivityRevisionDto = {
        id: p.expectedPlannedRevisionId!,
        termActivityId: p.termActivityId,
        revision: 1,
        baseActivityVersionId: "v",
        title: p.termActivityId,
        summary: null,
        changeReason: null,
        createdByInstructorId: null,
        createdAt: "2026-01-01T00:00:00Z",
        detail: {
          behaviorFamily: "meeting",
          calendarSlotId: p.calendarSlotId,
          startsAt: p.startsAt.toISOString(),
          endsAt: p.endsAt?.toISOString() ?? null,
          status: "scheduled",
          modality: null,
          overrideReason: null,
          overrideEvidence: null,
        },
        topicActions: [],
        milestones: [],
      };
      return [p.termActivityId, { planned, delivered: null }];
    }),
  );
  const driver = buildTermDailyDriver({
    termActivities,
    revisionsByTermActivityId,
    today: slots[20].date,
  });
  expect(driver.nextMeeting?.activity.id).toBe("m-20");
  expect(driver.nextMeeting?.meetingOrdinal).toBe(21);
});

describe("local time resolution", () => {
  const one = (
    date: string,
    defaultMeetingTime: MeetingPlacementInput["defaultMeetingTime"],
  ) =>
    planMeetingPlacement(
      input({ meetings: [meeting("a")], slots: [slot(date)], defaultMeetingTime }),
    ).placements[0].startsAt.toISOString();

  it.each([
    ["America/New_York", "2027-11-07", "01:30", "2027-11-07T05:30:00.000Z"],
    ["Europe/Berlin", "2027-10-31", "02:30", "2027-10-31T00:30:00.000Z"],
    ["Australia/Sydney", "2027-04-04", "02:30", "2027-04-03T15:30:00.000Z"],
  ])(
    "resolves a local time that occurs twice in %s to the earlier instant",
    (timeZone, date, startTimeLocal, expected) => {
      expect(one(date, { ...time, timeZone, startTimeLocal })).toBe(expected);
    },
  );

  it.each([
    ["America/New_York", "2027-03-14"],
    ["Europe/Berlin", "2027-03-28"],
  ])("rejects a local time that does not occur in %s", (timeZone, date) => {
    expect(() =>
      one(date, { ...time, timeZone, startTimeLocal: "02:30" }),
    ).toThrow(DomainInvariantError);
  });

  it("converts a zone east of UTC near midnight", () => {
    expect(
      one("2027-06-01", {
        ...time,
        timeZone: "Pacific/Auckland",
        startTimeLocal: "00:00",
      }),
    ).toBe("2027-05-31T12:00:00.000Z");
  });

  it("rejects an end time that is not after the start time", () => {
    expect(() =>
      one("2026-03-06", { ...time, endTimeLocal: "08:00" }),
    ).toThrow(DomainInvariantError);
  });
});
