// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Activity, Milestone } from "@/lib/b2r-prototype-fixture";
import MilestoneEditor from "./MilestoneEditor";

function makeMeeting(overrides: Partial<Activity>): Activity {
  return {
    id: overrides.id ?? "meeting-1",
    kind: "meeting",
    title: overrides.title ?? "Lecture 03",
    typeId: overrides.typeId ?? "type-meeting",
    primaryLmId: overrides.primaryLmId ?? "lm-1",
    ordinal: overrides.ordinal ?? 3,
    date: overrides.date ?? "2026-04-22",
    milestones: overrides.milestones ?? [],
    scopeLmIds: overrides.scopeLmIds ?? [],
  };
}

function makeProject(overrides: Partial<Activity> = {}): Activity {
  return {
    id: overrides.id ?? "project-1",
    kind: "project",
    title: overrides.title ?? "Capstone project",
    typeId: overrides.typeId ?? "type-project",
    primaryLmId: overrides.primaryLmId ?? null,
    ordinal: overrides.ordinal ?? null,
    date: overrides.date ?? null,
    milestones: overrides.milestones ?? [],
    scopeLmIds: overrides.scopeLmIds ?? ["lm-1", "lm-2"],
  };
}

describe("MilestoneEditor", () => {
  it("adds a meeting-linked milestone", () => {
    const onAdd = vi.fn();
    const project = makeProject();
    const meetings = [makeMeeting({ id: "meeting-1", title: "Lecture 03", date: "2026-04-22" })];

    render(<MilestoneEditor activity={project} meetingActivities={meetings} onAdd={onAdd} onRemove={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Milestone role/i), { target: { value: "released" } });
    fireEvent.change(screen.getByLabelText(/Milestone label/i), { target: { value: "Draft available" } });
    fireEvent.change(screen.getByLabelText(/^Meeting$/i), { target: { value: "meeting-1" } });
    fireEvent.click(screen.getByRole("button", { name: /add milestone/i }));

    expect(onAdd).toHaveBeenCalledWith({
      role: "released",
      label: "Draft available",
      linkedActivityId: "meeting-1",
      date: null,
      time: null,
    });
  });

  it("adds an exact date/time due milestone", () => {
    const onAdd = vi.fn();
    const project = makeProject();

    render(<MilestoneEditor activity={project} meetingActivities={[]} onAdd={onAdd} onRemove={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Milestone label/i), { target: { value: "Final report due" } });
    fireEvent.click(screen.getByLabelText(/Use exact date/i));
    fireEvent.change(screen.getByLabelText(/^Date$/i), { target: { value: "2026-05-12" } });
    fireEvent.change(screen.getByLabelText(/^Time$/i), { target: { value: "14:30" } });
    fireEvent.click(screen.getByRole("button", { name: /add milestone/i }));

    expect(onAdd).toHaveBeenCalledWith({
      role: "due",
      label: "Final report due",
      linkedActivityId: null,
      date: "2026-05-12",
      time: "14:30",
    });
  });

  it("shows existing milestones compactly", () => {
    const existing: Milestone[] = [
      {
        id: "ms-1",
        role: "released",
        label: "Draft announcement",
        linkedActivityId: "meeting-1",
      },
      {
        id: "ms-2",
        role: "due",
        label: "Final report",
        linkedActivityId: null,
        date: "2026-05-12",
        time: "09:00",
      },
    ];
    const project = makeProject({ milestones: existing });
    const meetings = [makeMeeting({ id: "meeting-1", title: "Lecture 03", date: "2026-04-22" })];

    render(<MilestoneEditor activity={project} meetingActivities={meetings} onAdd={vi.fn()} onRemove={vi.fn()} />);

    const list = screen.getByRole("list", { name: /existing milestones for capstone project/i });
    const releasedRow = within(list).getByLabelText(/Milestone Released Draft announcement/i);
    expect(within(releasedRow).getByText("Draft announcement")).toBeTruthy();
    expect(within(releasedRow).getByText(/Pinned to Lecture 03/i)).toBeTruthy();

    const dueRow = within(list).getByLabelText(/Milestone Due Final report/i);
    expect(within(dueRow).getByText("Final report")).toBeTruthy();
    expect(within(dueRow).getByText(/Exact date May 12, 2026 · 09:00/i)).toBeTruthy();
  });

  it("calls the removal callback for a milestone", () => {
    const onRemove = vi.fn();
    const project = makeProject({
      milestones: [
        {
          id: "ms-1",
          role: "review",
          label: "Midpoint critique",
          linkedActivityId: null,
          date: "2026-04-28",
        },
      ],
    });

    render(<MilestoneEditor activity={project} meetingActivities={[]} onAdd={vi.fn()} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: /remove review milestone midpoint critique/i }));

    expect(onRemove).toHaveBeenCalledWith("ms-1");
  });
});
