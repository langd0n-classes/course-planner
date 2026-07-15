import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { ConcurrencyConflictError, DomainInvariantError } from "@/services/redesign";

const prismaMock = {
  $transaction: vi.fn(),
};

const serviceMocks = vi.hoisted(() => ({
  previewTermCalendar: vi.fn(),
  applyTermCalendar: vi.fn(),
  listTermCalendarExceptions: vi.fn(),
  createTermCalendarException: vi.fn(),
  updateTermCalendarException: vi.fn(),
  deleteTermCalendarException: vi.fn(),
  listAcademicCalendarVersionsForInstructor: vi.fn(),
  createAcademicCalendarVersion: vi.fn(),
  getAcademicCalendarVersionForInstructor: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

vi.mock("@/services/redesign", async () => {
  const actual = await vi.importActual<typeof import("@/services/redesign")>("@/services/redesign");
  return {
    ...actual,
    ...serviceMocks,
  };
});

const authMock = vi.mocked(getAuthenticatedInstructor);

function instructor() {
  return { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.edu", name: "Alice" };
}

describe("term calendar and academic calendar routes", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./terms/[id]/calendar/preview/route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/calendar/preview", {
        method: "POST",
        body: JSON.stringify({ meetingPatterns: [] }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid preview payloads", async () => {
    const { POST } = await import("./terms/[id]/calendar/preview/route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/calendar/preview", {
        method: "POST",
        body: JSON.stringify({ meetingPatterns: [{ activityTypeVersionId: "not-a-uuid" }] }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for cross-instructor term calendar preview", async () => {
    serviceMocks.previewTermCalendar.mockRejectedValue(new DomainInvariantError("Term not found"));
    const { POST } = await import("./terms/[id]/calendar/preview/route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/calendar/preview", {
        method: "POST",
        body: JSON.stringify({
          meetingPatterns: [
            {
              activityTypeVersionId: "10000000-0000-4000-8000-000000000010",
              daysOfWeek: ["monday"],
              startTimeLocal: "09:00",
              endTimeLocal: "10:00",
              timeZone: "America/New_York",
              startsOn: "2027-03-01",
              endsOn: "2027-03-12",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns conflict on apply preview-token mismatch", async () => {
    serviceMocks.applyTermCalendar.mockRejectedValue(new ConcurrencyConflictError("Preview token mismatch"));
    const { POST } = await import("./terms/[id]/calendar/apply/route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/calendar/apply", {
        method: "POST",
        body: JSON.stringify({
          previewToken: "token-1",
          expectedCurrentCalendarSlotCount: 1,
          meetingPatterns: [
            {
              activityTypeVersionId: "10000000-0000-4000-8000-000000000010",
              daysOfWeek: ["monday"],
              startTimeLocal: "09:00",
              endTimeLocal: "10:00",
              timeZone: "America/New_York",
              startsOn: "2027-03-01",
              endsOn: "2027-03-12",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );
    expect(response.status).toBe(409);
  });

  it("lists and creates term calendar exceptions", async () => {
    serviceMocks.listTermCalendarExceptions.mockResolvedValue([
      {
        id: "exception-1",
        termId: "term-1",
        action: "cancel",
        activityTypeVersionId: null,
        calendarSlotId: null,
        targetDate: new Date("2027-03-03T00:00:00.000Z"),
        startsAt: null,
        endsAt: null,
        label: "Storm day",
        reason: "Weather",
        provenance: null,
      },
    ]);
    serviceMocks.createTermCalendarException.mockResolvedValue({
      id: "exception-2",
      termId: "term-1",
      action: "add",
      activityTypeVersionId: "10000000-0000-4000-8000-000000000010",
      calendarSlotId: null,
      targetDate: null,
      startsAt: new Date("2027-03-09T14:00:00.000Z"),
      endsAt: new Date("2027-03-09T15:00:00.000Z"),
      label: "Makeup",
      reason: "Replacement",
      provenance: null,
    });

    const { GET, POST } = await import("./terms/[id]/calendar-exceptions/route");
    const listResponse = await GET(new NextRequest("http://localhost/api/terms/term-1/calendar-exceptions"), {
      params: Promise.resolve({ id: "term-1" }),
    });
    expect(listResponse.status).toBe(200);

    const createResponse = await POST(
      new NextRequest("http://localhost/api/terms/term-1/calendar-exceptions", {
        method: "POST",
        body: JSON.stringify({
          action: "add",
          activityTypeVersionId: "10000000-0000-4000-8000-000000000010",
          startsAt: "2027-03-09T14:00:00.000Z",
          endsAt: "2027-03-09T15:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );
    expect(createResponse.status).toBe(201);
  });

  it("updates and deletes term calendar exceptions", async () => {
    serviceMocks.updateTermCalendarException.mockResolvedValue({
      id: "exception-1",
      termId: "term-1",
      action: "modify",
      activityTypeVersionId: null,
      calendarSlotId: null,
      targetDate: new Date("2027-03-12T00:00:00.000Z"),
      startsAt: null,
      endsAt: null,
      label: "Review day",
      reason: "Compressed week",
      provenance: null,
    });
    serviceMocks.deleteTermCalendarException.mockResolvedValue(undefined);

    const { PATCH, DELETE } = await import("./terms/[id]/calendar-exceptions/[exceptionId]/route");
    const patchResponse = await PATCH(
      new NextRequest("http://localhost/api/terms/term-1/calendar-exceptions/exception-1", {
        method: "PATCH",
        body: JSON.stringify({ label: "Review day" }),
      }),
      { params: Promise.resolve({ id: "term-1", exceptionId: "exception-1" }) },
    );
    expect(patchResponse.status).toBe(200);

    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/terms/term-1/calendar-exceptions/exception-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "term-1", exceptionId: "exception-1" }) },
    );
    expect(deleteResponse.status).toBe(200);
  });

  it("lists and creates academic calendar versions", async () => {
    serviceMocks.listAcademicCalendarVersionsForInstructor.mockResolvedValue([
      {
        id: "version-1",
        academicCalendarId: "calendar-1",
        version: 1,
        name: "2026-2027",
        academicYear: "2026-2027",
        sourceUri: null,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        archivedAt: null,
      },
    ]);
    serviceMocks.createAcademicCalendarVersion.mockResolvedValue({
      version: {
        id: "version-2",
        academicCalendarId: "calendar-1",
        version: 2,
        name: "2026-2027 Revised",
        academicYear: "2026-2027",
        sourceUri: null,
        publishedAt: new Date("2026-07-15T00:00:00.000Z"),
        archivedAt: null,
      },
      events: [],
      periods: [],
    });

    const { GET, POST } = await import("./academic-calendars/[id]/versions/route");
    const listResponse = await GET(new NextRequest("http://localhost/api/academic-calendars/calendar-1/versions"), {
      params: Promise.resolve({ id: "calendar-1" }),
    });
    expect(listResponse.status).toBe(200);

    const createResponse = await POST(
      new NextRequest("http://localhost/api/academic-calendars/calendar-1/versions", {
        method: "POST",
        body: JSON.stringify({ name: "2026-2027 Revised", academicYear: "2026-2027" }),
      }),
      { params: Promise.resolve({ id: "calendar-1" }) },
    );
    expect(createResponse.status).toBe(201);
  });
});
