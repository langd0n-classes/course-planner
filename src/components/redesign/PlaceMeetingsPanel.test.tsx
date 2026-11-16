// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type { MeetingPlacementPreviewResponse } from "@/lib/redesign-contract";
import PlaceMeetingsPanel from "./PlaceMeetingsPanel";
const preview: MeetingPlacementPreviewResponse = {
  kind: "preview",
  previewToken: "token",
  missingMeetingTime: false,
  alreadyDatedCount: 1,
  placements: [
    {
      termActivityId: "a",
      adoptedLabel: "Lecture",
      expectedPlannedRevisionId: "r",
      calendarSlotId: "s",
      date: "2026-03-06",
      startsAt: "2026-03-06T14:00:00Z",
      endsAt: null,
      timeZone: "America/New_York",
    },
  ],
  unplacedMeetings: [
    { termActivityId: "b", adoptedLabel: "Lab", reason: "no_learning_module" },
    { termActivityId: "c", adoptedLabel: "Seminar", reason: "no_slot_left" },
  ],
  emptySlots: [{ calendarSlotId: "e", date: "2026-03-09" }],
};
afterEach(() => setMockBackend(null));
it("previews on open, shows pairings and gaps, then applies and refreshes", async () => {
  const load = vi.fn(async () => preview);
  const apply = vi.fn(async () => ({
    kind: "applied" as const,
    placedCount: 1,
  }));
  const onApplied = vi.fn();
  setMockBackend({
    previewMeetingPlacement: load,
    applyMeetingPlacement: apply,
  });
  render(<PlaceMeetingsPanel termId="term" onApplied={onApplied} />);
  await screen.findByText(/Lecture/);
  expect(load).toHaveBeenCalledWith("term", { defaultMeetingTime: null });
  expect(screen.getByText(/No Learning Module assigned/)).toBeInTheDocument();
  expect(screen.getByText(/No class day left/)).toBeInTheDocument();
  expect(screen.getByText("2026-03-09")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(onApplied).toHaveBeenCalled());
  expect(apply).toHaveBeenCalledWith("term", {
    defaultMeetingTime: null,
    previewToken: "token",
  });
});
it("asks for fallback time, uses browser time zone, and requires a fresh preview after edits", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce({
      ...preview,
      placements: [],
      missingMeetingTime: true,
    })
    .mockResolvedValue(preview);
  setMockBackend({ previewMeetingPlacement: load });
  render(<PlaceMeetingsPanel termId="term" onApplied={vi.fn()} />);
  const start = await screen.findByLabelText("Start time");
  expect(screen.getByLabelText("Time zone")).toHaveValue(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  fireEvent.change(start, { target: { value: "09:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview again" }));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText("End time (optional)"), {
    target: { value: "10:00" },
  });
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
});
it("shows conflicts and offers a new preview", async () => {
  const load = vi.fn(async () => preview);
  setMockBackend({
    previewMeetingPlacement: load,
    applyMeetingPlacement: vi.fn(async () => {
      throw Object.assign(new Error("stale"), { status: 409 });
    }),
  });
  render(<PlaceMeetingsPanel termId="term" onApplied={vi.fn()} />);
  await screen.findByText(/Lecture/);
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The Term changed. Preview again.",
  );
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Preview again" }));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
});
it("displays a preview failure and disables Apply", async () => {
  setMockBackend({
    previewMeetingPlacement: vi.fn(async () => {
      throw new Error("Unable to load preview");
    }),
  });
  render(<PlaceMeetingsPanel termId="term" onApplied={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load preview",
  );
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
});
it("shows preview errors and permits retry", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("Unable to load placement"))
    .mockResolvedValue({ ...preview, placements: [] });
  setMockBackend({ previewMeetingPlacement: load });
  render(<PlaceMeetingsPanel termId="term" onApplied={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load placement",
  );
  fireEvent.click(screen.getByRole("button", { name: "Preview again" }));
  await screen.findByText("No meetings ready to place.");
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
});
