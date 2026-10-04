// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ImpactReport, type Term } from "@/lib/api-client";
import ImpactPage from "./[id]/impact/page";
import TermsPage from "./page";

const route = vi.hoisted(() => ({ id: "term-1" }));
vi.mock("next/navigation", () => ({ useParams: () => route }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function report(termId: string): ImpactReport {
  return {
    termId,
    errors: [],
    warnings: [],
    info: [{ type: "info", message: `Report for ${termId}` }],
    summary: {
      totalSkills: 0, totalSessions: 0, totalCoverageEntries: 0,
      errorCount: 0, warningCount: 0, infoCount: 1,
    },
  };
}

describe("legacy page loading", () => {
  beforeEach(() => { route.id = "term-1"; });
  afterEach(() => { vi.restoreAllMocks(); });

  it("shows loading on initial fetch and manual refresh", async () => {
    const initial = deferred<ImpactReport>();
    const refresh = deferred<ImpactReport>();
    const getReport = vi.spyOn(api, "getTermImpact")
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(refresh.promise);
    render(<ImpactPage />);
    expect(screen.getByText("Loading impact report...")).toBeInTheDocument();
    await act(async () => { initial.resolve(report("term-1")); });
    expect(screen.getByText("Report for term-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh Report" }));
    expect(screen.getByText("Loading impact report...")).toBeInTheDocument();
    await act(async () => { refresh.resolve(report("refreshed")); });
    expect(screen.getByText("Report for refreshed")).toBeInTheDocument();
    expect(getReport).toHaveBeenCalledTimes(2);
  });

  it("resets loading on navigation and ignores late results for the previous term", async () => {
    const initial = deferred<ImpactReport>();
    const oldRefresh = deferred<ImpactReport>();
    const next = deferred<ImpactReport>();
    vi.spyOn(api, "getTermImpact")
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(oldRefresh.promise)
      .mockReturnValueOnce(next.promise);
    const view = render(<ImpactPage />);
    await act(async () => { initial.resolve(report("term-1")); });
    fireEvent.click(screen.getByRole("button", { name: "Refresh Report" }));

    route.id = "term-2";
    view.rerender(<ImpactPage />);
    expect(screen.getByText("Loading impact report...")).toBeInTheDocument();
    await act(async () => { next.resolve(report("term-2")); });
    await act(async () => { oldRefresh.resolve(report("term-1")); });
    expect(screen.getByText("Report for term-2")).toBeInTheDocument();
    expect(screen.queryByText("Report for term-1")).not.toBeInTheDocument();
  });

  it("defaults the instructor once and preserves edits through a list refresh", async () => {
    const term: Term = {
      id: "term-1", code: "F26", name: "Fall", courseCode: "TEST",
      startDate: "2026-09-01", endDate: "2026-12-01",
      instructorId: "instructor-1", meetingPattern: null,
    };
    const instructors = [
      { id: "instructor-1", name: "First", email: "first@example.test" },
      { id: "instructor-2", name: "Second", email: "second@example.test" },
    ];
    const getTerms = vi.spyOn(api, "getTerms").mockResolvedValueOnce([term]).mockResolvedValue([]);
    const getInstructors = vi.spyOn(api, "getInstructors").mockResolvedValue(instructors);
    vi.spyOn(api, "deleteTerm").mockResolvedValue({ deleted: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TermsPage />);
    await screen.findByText("Fall");
    fireEvent.click(screen.getByRole("button", { name: "Create Term" }));
    const instructor = screen.getByRole("combobox");
    expect(instructor).toHaveValue("instructor-1");
    fireEvent.change(instructor, { target: { value: "instructor-2" } });
    expect(getInstructors).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => { expect(screen.queryByText("Fall")).not.toBeInTheDocument(); });
    expect(instructor).toHaveValue("instructor-2");
    expect(getTerms).toHaveBeenCalledTimes(2);
    expect(getInstructors).toHaveBeenCalledTimes(2);
  });
});
