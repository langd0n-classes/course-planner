// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TermOrderResult } from "@/lib/term-order-checks";
import TermOrderFindingsPanel from "./TermOrderFindingsPanel";

afterEach(cleanup);
const empty: TermOrderResult = {
  findings: [],
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
