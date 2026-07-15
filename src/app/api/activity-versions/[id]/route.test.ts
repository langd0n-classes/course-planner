import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { getActivityVersionForInstructorMock } = vi.hoisted(() => ({
  getActivityVersionForInstructorMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  getActivityVersionForInstructor: getActivityVersionForInstructorMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

function instructor() {
  return { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.edu", name: "Alice" };
}

function versionRow() {
  return {
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
  };
}

describe("Activity version detail route", () => {
  beforeEach(() => {
    getActivityVersionForInstructorMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-versions/av-1"), {
      params: Promise.resolve({ id: "av-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 for another instructor's Activity version", async () => {
    const { DomainInvariantError } = await import("@/services/redesign");
    getActivityVersionForInstructorMock.mockRejectedValueOnce(new DomainInvariantError("Activity version not found"));

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-versions/av-1"), {
      params: Promise.resolve({ id: "av-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns an owned Activity version", async () => {
    getActivityVersionForInstructorMock.mockResolvedValueOnce(versionRow());

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-versions/av-1"), {
      params: Promise.resolve({ id: "av-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.version.id).toBe("av-1");
    expect(body.version.detail.behaviorFamily).toBe("meeting");
  });
});
