import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { getActivityForInstructorMock, updateActivityMock } = vi.hoisted(() => ({
  getActivityForInstructorMock: vi.fn(),
  updateActivityMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  getActivityForInstructor: getActivityForInstructorMock,
  updateActivity: updateActivityMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

function instructor() {
  return { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.edu", name: "Alice" };
}

function activityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "act-1",
    courseId: "course-1",
    stableCode: "P1",
    currentVersionId: "av-1",
    archivedAt: null,
    ...overrides,
  };
}

function versionRow() {
  return {
    id: "av-1",
    activityId: "act-1",
    revision: 1,
    title: "Project 1",
    summary: null,
    activityTypeVersionId: "20000000-0000-4000-8000-000000000001",
    changeSummary: null,
    publishedAt: null,
    courseworkDetail: { submissionPolicy: null, releasePolicy: null, authoringNotes: null },
    meetingDetail: null,
    assessmentDetail: null,
    milestoneTemplates: [],
  };
}

describe("Activity detail route", () => {
  beforeEach(() => {
    getActivityForInstructorMock.mockReset();
    updateActivityMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activities/act-1"), {
      params: Promise.resolve({ id: "act-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 for another instructor's Activity", async () => {
    const { DomainInvariantError } = await import("@/services/redesign");
    getActivityForInstructorMock.mockRejectedValueOnce(new DomainInvariantError("Activity not found"));

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activities/act-1"), {
      params: Promise.resolve({ id: "act-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns an owned Activity with its current version", async () => {
    getActivityForInstructorMock.mockResolvedValueOnce({ activity: activityRow(), currentVersion: versionRow() });

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activities/act-1"), {
      params: Promise.resolve({ id: "act-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activity.id).toBe("act-1");
    expect(body.currentVersion.title).toBe("Project 1");
  });

  it("accepts an empty PATCH body as a no-op update", async () => {
    updateActivityMock.mockResolvedValueOnce(activityRow());
    getActivityForInstructorMock.mockResolvedValueOnce({ activity: activityRow(), currentVersion: versionRow() });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/activities/act-1", { method: "PATCH", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: "act-1" }) },
    );

    expect(response.status).toBe(200);
  });

  it("returns 400 for an invalid PATCH body", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/activities/act-1", {
        method: "PATCH",
        body: JSON.stringify({ stableCode: "" }),
      }),
      { params: Promise.resolve({ id: "act-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("updates stableCode via PATCH", async () => {
    updateActivityMock.mockResolvedValueOnce(activityRow({ stableCode: "P1-renamed" }));
    getActivityForInstructorMock.mockResolvedValueOnce({
      activity: activityRow({ stableCode: "P1-renamed" }),
      currentVersion: versionRow(),
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/activities/act-1", {
        method: "PATCH",
        body: JSON.stringify({ stableCode: "P1-renamed" }),
      }),
      { params: Promise.resolve({ id: "act-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activity.stableCode).toBe("P1-renamed");
    expect(updateActivityMock).toHaveBeenCalledWith(
      expect.anything(),
      instructor().id,
      "act-1",
      expect.objectContaining({ stableCode: "P1-renamed" }),
    );
  });

  it("archives an Activity via PATCH archivedAt", async () => {
    updateActivityMock.mockResolvedValueOnce(activityRow({ archivedAt: new Date("2026-07-14T00:00:00.000Z") }));
    getActivityForInstructorMock.mockResolvedValueOnce({
      activity: activityRow({ archivedAt: new Date("2026-07-14T00:00:00.000Z") }),
      currentVersion: versionRow(),
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/activities/act-1", {
        method: "PATCH",
        body: JSON.stringify({ archivedAt: "2026-07-14T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "act-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activity.archivedAt).toBe("2026-07-14T00:00:00.000Z");
  });
});
