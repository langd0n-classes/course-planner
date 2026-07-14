// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FixtureData } from "@/lib/b2r-prototype-fixture";
import RunViewport from "./RunViewport";

const exactTimeFixture: FixtureData = {
  courseTitle: "Test Course",
  courseCode: "TEST 100",
  termLabel: "Spring 2026",
  currentDate: "2026-03-18",
  topics: [],
  learningModules: [],
  activityTypes: [],
  activities: [
    {
      id: "proj01",
      kind: "project",
      title: "Project 1: Predictive Model",
      typeId: "at-project",
      primaryLmId: null,
      ordinal: 1,
      date: null,
      milestones: [
        {
          id: "proj01-due",
          role: "due",
          linkedActivityId: null,
          date: "2026-03-19",
          time: "09:00",
          label: "Due before L18",
        },
      ],
      scopeLmIds: [],
    },
  ],
  topicActions: [],
  calendar: [],
  termExceptions: [],
};

describe("RunViewport milestone time rendering", () => {
  it("renders exact milestone time beside the date in the next milestone card and upcoming row", () => {
    render(<RunViewport fixture={exactTimeFixture} />);

    const nextMilestoneCard = screen.getByText("Project 1: Predictive Model").parentElement?.parentElement;
    expect(nextMilestoneCard?.textContent).toContain("Thu, Mar 19 · 09:00");

    const upcomingSection = screen.getByLabelText("Upcoming sequence");
    const upcomingRow = within(upcomingSection).getByText("Due before L18").closest("li");
    expect(upcomingRow?.textContent).toContain("Thu, Mar 19 · 09:00");
  });
});
