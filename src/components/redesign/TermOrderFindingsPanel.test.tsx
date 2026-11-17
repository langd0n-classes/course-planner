// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TermOrderResult } from "@/lib/term-order-checks";
import TermOrderFindingsPanel from "./TermOrderFindingsPanel";

afterEach(cleanup);
const empty: TermOrderResult = {
  findings: [],
  unmappedActionCount: 0,
  undated: { count: 0, items: [] },
};
describe("TermOrderFindingsPanel", () => {
  it("shows a named region and the empty state", () => {
    render(<TermOrderFindingsPanel result={empty} activityLabels={{}} />);
    expect(
      screen.getByRole("region", { name: "Date order checks" }),
    ).toBeTruthy();
    expect(screen.getByText("No order problems found.")).toBeTruthy();
    expect(screen.getByText("0 findings")).toBeTruthy();
  });
  it("lists two findings with sentences, Activity labels, and dates", () => {
    render(
      <TermOrderFindingsPanel
        activityLabels={{ a: "Workshop", b: "Introduction" }}
        result={{
          ...empty,
          findings: [
            {
              kind: "practiced_before_introduced",
              topicId: "t",
              termActivityIds: ["a", "b"],
              dates: ["2026-02-01", "2026-02-02"],
              sentence: "Topic t is practiced before it is introduced.",
            },
            {
              kind: "never_introduced",
              topicId: "other",
              termActivityIds: ["a", null],
              dates: ["2026-02-01", null],
              sentence: "Topic other is never introduced.",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("2 findings")).toBeTruthy();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0]).getByText(
        "Topic t is practiced before it is introduced.",
      ),
    ).toBeTruthy();
    expect(rows[0].textContent).toContain("Workshop");
    expect(rows[0].textContent).toContain("Introduction");
    expect(rows[0].querySelectorAll("time")).toHaveLength(2);
    expect(rows[1].textContent).not.toContain("null");
  });
  it("reports the undated count and incomplete check even with no findings", () => {
    render(
      <TermOrderFindingsPanel
        activityLabels={{}}
        result={{
          ...empty,
          undated: {
            count: 2,
            items: [
              { termActivityId: "a", milestoneId: null },
              { termActivityId: "a", milestoneId: "m" },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText(/2 undated Activities or milestones/)).toBeTruthy();
    expect(screen.getByText(/Check is incomplete/)).toBeTruthy();
  });
});

it("shows singular undated copy, missing labels, milestone totals and unmapped actions", () => {
  render(
    <TermOrderFindingsPanel
      activityLabels={{ a: "Workshop" }}
      result={{
        ...empty,
        unmappedActionCount: 2,
        undated: {
          count: 1,
          items: [{ termActivityId: "missing", milestoneId: "m" }],
        },
        findings: [
          {
            kind: "never_introduced",
            topicId: "t",
            termActivityIds: ["missing", null],
            dates: ["2026-02-01", null],
            sentence: "Never introduced.",
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("1 finding");
  expect(screen.getByText(/1 undated Activity or milestone\./)).toBeTruthy();
  expect(screen.getByText(/2 Topic actions could not be checked/)).toBeTruthy();
  const lists = screen.getAllByRole("list");
  expect(lists).toHaveLength(2);
  lists.forEach((list) => expect(list.getAttribute("role")).toBe("list"));
  expect(lists[0].textContent).toContain("missing");
  expect(lists[0].querySelectorAll("time")).toHaveLength(1);
  expect(lists[1].textContent).toContain("missing: 1 undated milestone");
});
it("lists each undated Activity once with its label and milestone count", () => {
  render(
    <TermOrderFindingsPanel
      activityLabels={{ a: "Workshop" }}
      result={{
        ...empty,
        undated: {
          count: 4,
          items: [
            { termActivityId: "a", milestoneId: null },
            { termActivityId: "a", milestoneId: "m1" },
            { termActivityId: "a", milestoneId: "m2" },
            { termActivityId: "b", milestoneId: null },
          ],
        },
      }}
    />,
  );
  expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual(
    ["Workshop: 2 undated milestones", "b: 0 undated milestones"],
  );
});
