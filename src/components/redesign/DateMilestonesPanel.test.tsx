// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type { MilestoneDatingPreviewResponse } from "@/lib/redesign-contract";
import DateMilestonesPanel from "./DateMilestonesPanel";
const item = {
  termActivityId: "work",
  adoptedLabel: "Practice",
  milestoneId: "m",
  sourceTemplateId: "t",
  label: "Practice due",
  linkedTermActivityId: "meeting",
  linkedMeetingLabel: "Lecture",
};
const preview: MilestoneDatingPreviewResponse = {
  kind: "preview",
  previewToken: "token",
  dates: [{ ...item, occursAt: "2026-03-06T14:00:00Z", timeZone: "UTC" }],
  creates: [{ ...item, milestoneId: null }],
  undated: [
    {
      ...item,
      milestoneId: "other",
      label: "Review",
      reason: "no_default_time",
    },
  ],
  alreadyDatedCount: 2,
};
afterEach(() => setMockBackend(null));
function mount(onApplied = vi.fn()) {
  return render(
    <DateMilestonesPanel
      termId="term"
      timeZone="America/New_York"
      onApplied={onApplied}
    />,
  );
}
it("has a labelled region and a live region before preview resolves", async () => {
  setMockBackend({ previewMilestoneDating: () => new Promise(() => {}) });
  const { container } = mount();
  expect(
    screen.getByRole("region", { name: "Date milestones" }),
  ).toBeInTheDocument();
  expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
});
it("previews on open, shows dates in the Term zone, creations, reasons and the known limit", async () => {
  const load = vi.fn(async () => preview);
  const apply = vi.fn(async () => ({
    kind: "applied" as const,
    datedCount: 1,
    createdCount: 1,
  }));
  const refresh = vi.fn();
  setMockBackend({ previewMilestoneDating: load, applyMilestoneDating: apply });
  mount(refresh);
  expect(await screen.findByText(/09:00/)).toHaveTextContent(
    "America/New_York",
  );
  expect(
    screen.getByRole("heading", { name: "Milestones to create (1)" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Review:.*no default time/i)).toBeInTheDocument();
  expect(screen.getByText(/Moving a meeting later/)).toBeInTheDocument();
  expect(load).toHaveBeenCalledWith("term", {});
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(apply).toHaveBeenCalledWith("term", { previewToken: "token" });
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
});
it.each([409, 500])(
  "handles %s and prevents duplicate apply",
  async (status) => {
    let reject!: (error: Error) => void;
    const apply = vi.fn(
      () =>
        new Promise<never>((_, fail) => {
          reject = fail;
        }),
    );
    setMockBackend({
      previewMilestoneDating: async () => preview,
      applyMilestoneDating: apply,
    });
    mount();
    const button = screen.getByRole("button", { name: "Apply" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(button);
    expect(apply).toHaveBeenCalledOnce();
    reject(Object.assign(new Error("Apply failed"), { status }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      status === 409 ? "The Term changed. Preview again." : "Apply failed",
    );
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Preview again" }));
    await waitFor(() => expect(button).toBeEnabled());
  },
);
it("handles preview failure and allows retry", async () => {
  setMockBackend({
    previewMilestoneDating: async () => {
      throw new Error("Preview failed");
    },
  });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("Preview failed");
  expect(screen.getByRole("button", { name: "Preview again" })).toBeEnabled();
});
it("disables apply for an empty preview", async () => {
  setMockBackend({
    previewMilestoneDating: async () => ({
      ...preview,
      dates: [],
      creates: [],
    }),
  });
  mount();
  expect(
    await screen.findByText("No milestones ready to date or create."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
});
