// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import CreateTermPanel from "./CreateTermPanel";

const institutions = [
  { id: "inst-1", name: "UC Berkeley", shortName: "Berkeley", canonicalUri: null, archivedAt: null },
  { id: "inst-2", name: "Extension", shortName: "Extension", canonicalUri: null, archivedAt: null },
];
const calendars = [
  {
    id: "cal-1",
    institutionId: "inst-1",
    name: "2026-27",
    academicYear: "2026-27",
    version: 1,
    sourceUri: null,
    publishedAt: null,
    archivedAt: null,
  },
  {
    id: "cal-2",
    institutionId: "inst-2",
    name: "2026 Extension",
    academicYear: "2026",
    version: 1,
    sourceUri: null,
    publishedAt: null,
    archivedAt: null,
  },
];

describe("CreateTermPanel", () => {
  const onTermCreated = vi.fn();
  const previewTermCreation = vi.fn().mockResolvedValue({
    kind: "preview",
    calendarSlotCandidates: [
      {
        date: "2027-01-21",
        slotType: "class_day",
        label: null,
        source: "meeting_role",
        academicCalendarEventId: null,
        meetingRoleKeys: ["lecture"],
        meetingRoleLabels: ["Lecture"],
        instructionalCapacity: "normal",
        capacitySource: "baseline",
        capacityReason: "No explicit break-proximity signal in the calendar.",
        provenance: [],
      },
      {
        date: "2027-01-24",
        slotType: "class_day",
        label: null,
        source: "meeting_role",
        academicCalendarEventId: null,
        meetingRoleKeys: ["lecture"],
        meetingRoleLabels: ["Lecture"],
        instructionalCapacity: "normal",
        capacitySource: "baseline",
        capacityReason: "No explicit break-proximity signal in the calendar.",
        provenance: [],
      },
    ],
    conflicts: [],
    warnings: [],
  });
  const applyTermCreation = vi.fn().mockResolvedValue({
    kind: "applied",
    term: { id: "term-1", courseId: "course-1", institutionId: "inst-2", academicCalendarId: "cal-2", code: "SP27", name: "Spring 2027", startDate: "2027-01-19", endDate: "2027-05-07", meetingPattern: null, status: "planned", closedAt: null, clonedFromId: null, archivedAt: null },
    calendarSlotCount: 2,
    warnings: [],
  });

  beforeEach(() => {
    setMockBackend({ previewTermCreation, applyTermCreation });
  });

  afterEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
  });

  it("filters calendars by institution and shows a preview before applying", async () => {
    render(
      <CreateTermPanel
        courseId="course-1"
        institutions={institutions}
        calendars={calendars}
        onTermCreated={onTermCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Institution"), { target: { value: "inst-2" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Academic Calendar")).toHaveValue("cal-2");
    });

    fireEvent.change(screen.getByLabelText("Term Code"), { target: { value: "SP27" } });
    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "Spring 2027" } });
    fireEvent.change(screen.getByLabelText("Start Date"), { target: { value: "2027-01-19" } });
    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2027-05-07" } });
    fireEvent.click(screen.getByText("Fri"));
    fireEvent.click(screen.getByRole("button", { name: "Preview term" }));

    await waitFor(() => {
      expect(previewTermCreation).toHaveBeenCalledWith({
        courseId: "course-1",
        institutionId: "inst-2",
        academicCalendarId: "cal-2",
        code: "SP27",
        name: "Spring 2027",
        startDate: "2027-01-19",
        endDate: "2027-05-07",
        meetingPattern: { roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["Fri"] }] },
      });
    });

    // Preview panel is shown
    await waitFor(() => {
      expect(screen.getByText("Preview: Spring 2027")).toBeInTheDocument();
      expect(screen.getByText("Confirm and create term")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Confirm and create term"));

    await waitFor(() => {
      expect(applyTermCreation).toHaveBeenCalled();
      expect(onTermCreated).toHaveBeenCalled();
    });
  });

  it("shows conflicts and disables apply when there are blockers", async () => {
    previewTermCreation.mockResolvedValueOnce({
      kind: "preview",
      calendarSlotCandidates: [],
      conflicts: [{ code: "date_order", date: null, meetingRoleKey: null, message: "Start date must be before end date." }],
      warnings: [],
    });

    render(
      <CreateTermPanel
        courseId="course-1"
        institutions={institutions}
        calendars={calendars}
        onTermCreated={onTermCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Term Code"), { target: { value: "FA27" } });
    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "Fall 2027" } });
    fireEvent.change(screen.getByLabelText("Start Date"), { target: { value: "2027-12-01" } });
    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2027-08-01" } });
    fireEvent.click(screen.getByText("Mon"));
    fireEvent.click(screen.getByRole("button", { name: "Preview term" }));

    await waitFor(() => {
      expect(screen.getByText("Start date must be before end date.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Confirm and create term" })).toBeDisabled();
  });
});
