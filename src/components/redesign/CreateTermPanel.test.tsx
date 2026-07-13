// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    calendarSlotCandidates: Array.from({ length: 13 }, (_, index) => {
      const date = `2027-01-${String(index + 1).padStart(2, "0")}`;
      const advisoryByDate: Record<
        string,
        {
          instructionalCapacity: "reduced_engagement" | "recovery" | "assessment_period";
          capacitySource: "heuristic" | "instructor_override";
          capacityReason: string;
          provenance: Array<{
            source: "academic_calendar_event" | "instructor_override" | "meeting_role_pattern";
            referenceId: string | null;
            detail: string;
          }>;
        }
      > = {
        "2027-01-03": {
          instructionalCapacity: "reduced_engagement",
          capacitySource: "heuristic",
          capacityReason: "Reduced capacity before the midterm break.",
          provenance: [
            {
              source: "academic_calendar_event",
              referenceId: "event-1",
              detail: "Break day on 2027-01-05.",
            },
            {
              source: "meeting_role_pattern",
              referenceId: null,
              detail: "Lecture role remains scheduled on adjacent class days.",
            },
          ],
        },
        "2027-01-06": {
          instructionalCapacity: "recovery",
          capacitySource: "instructor_override",
          capacityReason: "Recovery class after the break week.",
          provenance: [
            {
              source: "instructor_override",
              referenceId: null,
              detail: "Instructor override keeps the class meeting after the break.",
            },
          ],
        },
        "2027-01-11": {
          instructionalCapacity: "assessment_period",
          capacitySource: "instructor_override",
          capacityReason: "Assessment period session with tightened instructional load.",
          provenance: [
            {
              source: "instructor_override",
              referenceId: null,
              detail: "Instructor override marks the assessment period advisory.",
            },
          ],
        },
        "2027-01-12": {
          instructionalCapacity: "reduced_engagement",
          capacitySource: "heuristic",
          capacityReason: "Reduced capacity as the term closes.",
          provenance: [
            {
              source: "academic_calendar_event",
              referenceId: "event-2",
              detail: "Finals week begins on 2027-01-13.",
            },
            {
              source: "meeting_role_pattern",
              referenceId: null,
              detail: "Lecture role remains scheduled on the last class day.",
            },
          ],
        },
      };
      const advisory = advisoryByDate[date];

      return {
        date,
        slotType: "class_day" as const,
        label: null,
        source: "meeting_roles:lecture",
        academicCalendarEventId: null,
        meetingRoleKeys: ["lecture"],
        meetingRoleLabels: ["Lecture"],
        instructionalCapacity: advisory?.instructionalCapacity ?? "normal",
        capacitySource: advisory?.capacitySource ?? "baseline",
        capacityReason: advisory?.capacityReason ?? "No explicit break-proximity signal in the calendar.",
        provenance:
          advisory?.provenance ?? [
            {
              source: "meeting_role_pattern" as const,
              referenceId: null,
              detail: "Lecture role remains scheduled on the class day.",
            },
          ],
      };
    }),
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
      expect(screen.getByText("Capacity advisories")).toBeInTheDocument();
    });

    const firstAdvisoryCard = screen.getByText("2027-01-03").closest("article");
    expect(firstAdvisoryCard).not.toBeNull();
    if (!firstAdvisoryCard) throw new Error("Expected the first advisory card to exist.");
    expect(within(firstAdvisoryCard).getByText("Capacity source: Heuristic")).toBeInTheDocument();
    expect(within(firstAdvisoryCard).getByText("Schedule source: meeting_roles:lecture")).toBeInTheDocument();
    expect(within(firstAdvisoryCard).getByText("Reduced capacity before the midterm break.")).toBeInTheDocument();

    const baselinePreviewRow = screen.getByLabelText("Candidate class day 2027-01-01");
    const baselinePreviewWithin = within(baselinePreviewRow);
    expect(baselinePreviewWithin.getByText("Normal capacity")).toBeInTheDocument();
    expect(baselinePreviewWithin.queryByText("Capacity source:")).not.toBeInTheDocument();
    expect(baselinePreviewWithin.queryByText("Schedule source:")).not.toBeInTheDocument();
    expect(
      baselinePreviewWithin.queryByText("No explicit break-proximity signal in the calendar."),
    ).not.toBeInTheDocument();
    expect(baselinePreviewWithin.queryByText("Meeting role pattern:")).not.toBeInTheDocument();

    const advisoriesSection = screen.getByText("Capacity advisories").closest("div");
    expect(advisoriesSection).not.toBeNull();
    if (!advisoriesSection) throw new Error("Expected the capacity advisories section to exist.");
    const advisoriesWithin = within(advisoriesSection);
    const laterAdvisoryCard = advisoriesWithin.getByText("2027-01-11").closest("article");
    expect(laterAdvisoryCard).not.toBeNull();
    if (!laterAdvisoryCard) throw new Error("Expected the later advisory card to exist.");
    expect(within(laterAdvisoryCard).getByText("Capacity source: Instructor override")).toBeInTheDocument();
    expect(within(laterAdvisoryCard).getByText("Schedule source: meeting_roles:lecture")).toBeInTheDocument();
    expect(within(laterAdvisoryCard).getByText("Assessment period session with tightened instructional load.")).toBeInTheDocument();
    expect(advisoriesWithin.queryByText("2027-01-03")).not.toBeInTheDocument();
    expect(advisoriesWithin.queryByText("2027-01-13")).not.toBeInTheDocument();

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
