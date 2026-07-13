// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateTermPanel from "./CreateTermPanel";

describe("CreateTermPanel", () => {
  it("filters calendars by institution and submits the selected contract fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateTermPanel
        institutions={[
          { id: "inst-1", name: "UC Berkeley", shortName: "Berkeley", canonicalUri: null, archivedAt: null },
          { id: "inst-2", name: "Extension", shortName: "Extension", canonicalUri: null, archivedAt: null },
        ]}
        calendars={[
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
        ]}
        onSubmit={onSubmit}
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
    fireEvent.click(screen.getByRole("button", { name: "Create Term" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        institutionId: "inst-2",
        academicCalendarId: "cal-2",
        code: "SP27",
        name: "Spring 2027",
        startDate: "2027-01-19",
        endDate: "2027-05-07",
        meetingPattern: { days: ["Fri"] },
      });
    });
  });
});
