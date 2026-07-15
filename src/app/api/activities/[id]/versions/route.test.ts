import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { getActivityForInstructorMock, listActivityVersionsForInstructorMock, reviseActivityMock } = vi.hoisted(() => ({
  getActivityForInstructorMock: vi.fn(),
  listActivityVersionsForInstructorMock: vi.fn(),
  reviseActivityMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  ConcurrencyConflictError: class ConcurrencyConflictError extends Error {
    constructor() {
      super("Activity was modified concurrently");
    }
  },
  getActivityForInstructor: getActivityForInstructorMock,
  listActivityVersionsForInstructor: listActivityVersionsForInstructorMock,
  reviseActivity: reviseActivityMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

function instructor() {
  return { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.edu", name: "Alice" };
}

function assessmentDraft() {
  return {
    title: "Midterm",
    summary: null,
    activityTypeVersionId: "20000000-0000-4000-8000-000000000001",
    changeSummary: "revised rubric",
    detail: { behaviorFamily: "assessment" as const, modality: null, authoringNotes: null },
  };
}

function versionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "av-2",
    activityId: "act-1",
    revision: 2,
    title: "Midterm",
    summary: null,
    activityTypeVersionId: "20000000-0000-4000-8000-000000000001",
    changeSummary: "revised rubric",
    publishedAt: null,
    meetingDetail: null,
    courseworkDetail: null,
    assessmentDetail: { modality: null, authoringNotes: null },
    milestoneTemplates: [],
    ...overrides,
  };
}

describe("Activity versions route", () => {
  beforeEach(() => {
    getActivityForInstructorMock.mockReset();
    listActivityVersionsForInstructorMock.mockReset();
    reviseActivityMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activities/act-1/versions"), {
      params: Promise.resolve({ id: "act-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("lists versions ordered by revision", async () => {
    listActivityVersionsForInstructorMock.mockResolvedValueOnce([versionRow({ revision: 1 }), versionRow()]);

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activities/act-1/versions"), {
      params: Promise.resolve({ id: "act-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.versions).toHaveLength(2);
    expect(body.versions[1].revision).toBe(2);
  });

  it("returns 404 when listing versions for another instructor's Activity", async () => {
    const { DomainInvariantError } = await import("@/services/redesign");
    listActivityVersionsForInstructorMock.mockRejectedValueOnce(new DomainInvariantError("Activity not found"));

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activities/act-1/versions"), {
      params: Promise.resolve({ id: "act-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid revise body", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/activities/act-1/versions", {
        method: "POST",
        body: JSON.stringify({ title: "" }),
      }),
      { params: Promise.resolve({ id: "act-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("creates a new version and returns 201", async () => {
    getActivityForInstructorMock.mockResolvedValueOnce({
      activity: { id: "act-1", courseId: "course-1", stableCode: "P1", currentVersionId: "av-1", archivedAt: null },
      currentVersion: versionRow({ id: "av-1", revision: 1 }),
    });
    reviseActivityMock.mockResolvedValueOnce(versionRow());

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/activities/act-1/versions", {
        method: "POST",
        body: JSON.stringify({
          expectedCurrentVersionId: "20000000-0000-4000-8000-000000000009",
          ...assessmentDraft(),
        }),
      }),
      { params: Promise.resolve({ id: "act-1" }) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.version.revision).toBe(2);
    expect(body.version.detail.behaviorFamily).toBe("assessment");
  });

  it("returns 409 from a ConcurrencyConflictError raised by revise", async () => {
    getActivityForInstructorMock.mockResolvedValueOnce({
      activity: { id: "act-1", courseId: "course-1", stableCode: "P1", currentVersionId: "av-1", archivedAt: null },
      currentVersion: versionRow({ id: "av-1", revision: 1 }),
    });
    const { ConcurrencyConflictError } = await import("@/services/redesign");
    reviseActivityMock.mockRejectedValueOnce(new ConcurrencyConflictError());

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/activities/act-1/versions", {
        method: "POST",
        body: JSON.stringify({
          expectedCurrentVersionId: "20000000-0000-4000-8000-000000000009",
          ...assessmentDraft(),
        }),
      }),
      { params: Promise.resolve({ id: "act-1" }) },
    );

    expect(response.status).toBe(409);
  });
});
