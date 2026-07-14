// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ActivityType } from "../../lib/b2r-prototype-fixture";

import { ActivityTypeEditor } from "./ActivityTypeEditor";

describe("ActivityTypeEditor", () => {
  it("shows the stable family separately from the editable label", () => {
    const activityTypes: ActivityType[] = [
      { id: "activity-1", label: "Discussion section", family: "Meeting" },
    ];

    render(
      <ActivityTypeEditor
        activityTypes={activityTypes}
        onCreate={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    const row = screen.getByRole("listitem");

    expect(
      within(row).getByRole("textbox", {
        name: /Instructor label activity-1/i,
      }),
    ).toHaveValue("Discussion section");
    expect(within(row).getByText("Meeting")).toBeVisible();
    expect(screen.getByText(/Labels are course-specific while families drive behavior\./i)).toBeVisible();
  });

  it("calls onRename when an instructor label is edited", () => {
    const onRename = vi.fn();

    render(
      <ActivityTypeEditor
        activityTypes={[
          { id: "activity-1", label: "Discussion section", family: "Meeting" },
        ]}
        onCreate={vi.fn()}
        onRename={onRename}
      />,
    );

    const input = screen.getByRole("textbox", {
      name: /Instructor label activity-1/i,
    });

    fireEvent.change(input, { target: { value: "Studio section" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRename).toHaveBeenCalledOnce();
    expect(onRename).toHaveBeenCalledWith({
      id: "activity-1",
      label: "Studio section",
    });
  });

  it("creates a custom label and stable family pair", () => {
    const onCreate = vi.fn();

    render(
      <ActivityTypeEditor
        activityTypes={[]}
        onCreate={onCreate}
        onRename={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Instructor label/i), {
      target: { value: "Recitation" },
    });
    fireEvent.change(screen.getByLabelText(/Stable family/i), {
      target: { value: "Coursework" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add type/i }));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledWith({
      label: "Recitation",
      family: "Coursework",
    });
  });
});
