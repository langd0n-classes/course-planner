import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { listActivitiesForCourseMock, createActivityMock } = vi.hoisted(() => ({
  listActivitiesForCourseMock: vi.fn(),
  createActivityMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  listActivitiesForCourse: listActivitiesForCourseMock,
  createActivity: createActivityMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

function instructor() {
  return { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.edu", name: "Alice" };
}

function meetingDraft() {
  return {
    title: "Lecture 01",
    summary: null,
    activityTypeVersionId: "20000000-0000-4000-8000-000000000001",
    changeSummary: null,
    detail: { behaviorFamily: "meeting" as const, defaultDurationMinutes: 75, modality: null, preparationNotes: null, authoringNotes: null },
    milestoneTemplates: [],
  };
}

describe("Course Activities collection route", () => {
  beforeEach(() => {
    listActivitiesForCourseMock.mockReset();
    createActivityMock.mockReset();
    authMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/courses/course-1/activities"), {
      params: Promise.resolve({ id: "course-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("lists Activities for an owned Course", async () => {
    authMock.mockResolvedValue(instructor());
    listActivitiesForCourseMock.mockResolvedValueOnce([
      { id: "act-1", courseId: "course-1", stableCode: "P1", currentVersionId: "av-1", archivedAt: null },
    ]);

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/courses/course-1/activities"), {
      params: Promise.resolve({ id: "course-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activities: [{ id: "act-1", courseId: "course-1", stableCode: "P1", currentVersionId: "av-1", archivedAt: null }],
    });
  });

  it("returns 404 for a Course owned by another instructor", async () => {
    authMock.mockResolvedValue(instructor());
    const { DomainInvariantError } = await import("@/services/redesign");
    listActivitiesForCourseMock.mockRejectedValueOnce(new DomainInvariantError("Course not found"));

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/courses/course-1/activities"), {
      params: Promise.resolve({ id: "course-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid create body", async () => {
    authMock.mockResolvedValue(instructor());

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/courses/course-1/activities", {
        method: "POST",
        body: JSON.stringify({ stableCode: "" }),
      }),
      { params: Promise.resolve({ id: "course-1" }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.details).toBeDefined();
  });

  it("returns 403 when creating for another instructor", async () => {
    authMock.mockResolvedValue(instructor());

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/courses/course-1/activities", {
        method: "POST",
        body: JSON.stringify({
          stableCode: "P1",
          createdByInstructorId: "10000000-0000-4000-8000-000000000002",
          version: meetingDraft(),
        }),
      }),
      { params: Promise.resolve({ id: "course-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("creates an Activity and its revision-1 version, returning 201", async () => {
    authMock.mockResolvedValue(instructor());
    createActivityMock.mockResolvedValueOnce({
      id: "act-1",
      courseId: "course-1",
      stableCode: "P1",
      currentVersionId: "av-1",
      archivedAt: null,
      currentVersion: {
        id: "av-1",
        activityId: "act-1",
        revision: 1,
        title: "Lecture 01",
        summary: null,
        activityTypeVersionId: "20000000-0000-4000-8000-000000000001",
        changeSummary: null,
        publishedAt: null,
        meetingDetail: { defaultDurationMinutes: 75, modality: null, preparationNotes: null, authoringNotes: null },
        courseworkDetail: null,
        assessmentDetail: null,
        milestoneTemplates: [],
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/courses/course-1/activities", {
        method: "POST",
        body: JSON.stringify({
          stableCode: "P1",
          createdByInstructorId: instructor().id,
          version: meetingDraft(),
        }),
      }),
      { params: Promise.resolve({ id: "course-1" }) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.activity.stableCode).toBe("P1");
    expect(body.currentVersion.revision).toBe(1);
    expect(body.currentVersion.detail.behaviorFamily).toBe("meeting");
  });
});
