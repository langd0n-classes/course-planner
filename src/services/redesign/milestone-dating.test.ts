import { describe, expect, it } from "vitest";
import {
  planMilestoneDating,
  type MilestoneDatingActivity,
} from "./milestone-dating";

export function datingFixture(): MilestoneDatingActivity[] {
  return [
    {
      id: "work",
      activityId: "base-work",
      adoptedLabel: "Practice",
      plannedRevisionId: "r",
      milestones: [
        {
          id: "m",
          sourceTemplateId: "t",
          label: "Due",
          role: "due",
          anchorPolicy: "follow_activity",
          linkedTermActivityId: "meeting",
          occursAt: null,
        },
      ],
      templates: [
        {
          id: "t",
          sequence: 0,
          label: "Due",
          role: "due",
          linkedActivityId: "base-meeting",
          relativeDays: 0,
          defaultTime: "09:00",
          timeZone: "America/New_York",
        },
      ],
      meeting: null,
    },
    {
      id: "meeting",
      activityId: "base-meeting",
      adoptedLabel: "Lecture",
      plannedRevisionId: "mr",
      milestones: [],
      templates: [],
      meeting: {
        startsAt: new Date("2026-03-07T01:00:00Z"),
        calendarSlotId: null,
      },
    },
  ];
}
const plan = (activities = datingFixture()) =>
  planMilestoneDating({ activities, slots: [{ id: "s", date: "2026-03-09" }] });
describe("milestone dating planner", () => {
  it.each([
    [1, "2026-03-07T14:00:00.000Z"],
    [0, "2026-03-06T14:00:00.000Z"],
    [-1, "2026-03-05T14:00:00.000Z"],
    [null, "2026-03-06T14:00:00.000Z"],
    [3, "2026-03-09T13:00:00.000Z"],
  ])("adds %s local days", (offset, expected) => {
    const a = datingFixture();
    a[0].templates[0].relativeDays = offset as number | null;
    expect(plan(a).dates[0].occursAt.toISOString()).toBe(expected);
  });
  it("dates from sourceTemplateId even after the base version has changed", () => {
    const a = datingFixture();
    a[0].sourceTemplates = a[0].templates;
    a[0].templates = [];
    expect(plan(a).dates[0].occursAt.toISOString()).toBe(
      "2026-03-06T14:00:00.000Z",
    );
    expect(plan(a).creates).toEqual([]);
  });
  it("uses the slot when the meeting has no instant", () => {
    const a = datingFixture();
    a[1].meeting = { startsAt: null, calendarSlotId: "s" };
    expect(plan(a).dates[0].occursAt.toISOString()).toBe(
      "2026-03-09T13:00:00.000Z",
    );
  });
  it.each([
    "linked_meeting_undated",
    "linked_activity_not_a_meeting",
    "no_template",
    "no_default_time",
    "no_time_zone",
    "local_time_does_not_exist",
  ] as const)("reports %s", (reason) => {
    const a = datingFixture();
    if (reason === "linked_meeting_undated") a[1].meeting!.startsAt = null;
    if (reason === "linked_activity_not_a_meeting") a[1].meeting = null;
    if (reason === "no_template") a[0].templates = [];
    if (reason === "no_default_time") a[0].templates[0].defaultTime = null;
    if (reason === "no_time_zone") a[0].templates[0].timeZone = null;
    if (reason === "local_time_does_not_exist") {
      a[0].templates[0].relativeDays = 2;
      a[0].templates[0].defaultTime = "02:30";
    }
    expect(plan(a).undated[0].reason).toBe(reason);
    expect(plan(a).dates).toEqual([]);
  });
  it("resolves repeated times to the earlier instant", () => {
    const a = datingFixture();
    a[1].meeting!.startsAt = new Date("2026-11-01T16:00:00Z");
    a[0].templates[0].defaultTime = "01:30";
    expect(plan(a).dates[0].occursAt.toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
  });
  it("keeps dated milestones and ignores other anchor policies", () => {
    const a = datingFixture();
    a[0].milestones[0].occursAt = new Date();
    expect(plan(a)).toMatchObject({ dates: [], alreadyDatedCount: 1 });
    a[0].milestones[0].occursAt = null;
    a[0].milestones[0].anchorPolicy = "standalone";
    expect(plan(a).dates).toEqual([]);
  });
  it("creates and dates missing templates only when they can follow another Term Activity", () => {
    const a = datingFixture();
    a[0].milestones = [];
    expect(plan(a).creates).toHaveLength(1);
    expect(plan(a).dates[0].milestoneId).toBeNull();
    a[0].templates[0].linkedActivityId = null;
    expect(plan(a).creates).toEqual([]);
    a[0].templates[0].linkedActivityId = "base-work";
    expect(plan(a).creates).toEqual([]);
  });
  it("creates a missing milestone even if its linked meeting is still undated", () => {
    const a = datingFixture();
    a[0].milestones = [];
    a[1].meeting!.startsAt = null;
    expect(plan(a)).toMatchObject({
      dates: [],
      creates: [expect.anything()],
      undated: [expect.objectContaining({ reason: "linked_meeting_undated" })],
    });
  });
});
