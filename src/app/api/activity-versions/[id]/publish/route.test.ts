import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { publishActivityVersionMock } = vi.hoisted(() => ({
  publishActivityVersionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  publishActivityVersion: publishActivityVersionMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

function instructor() {
  return { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.edu", name: "Alice" };
}

function versionRow(publishedAt: string | null) {
  return {
    id: "av-1",
    activityId: "act-1",
    revision: 1,
    title: "Lecture 01",
    summary: null,
    activityTypeVersionId: "20000000-0000-4000-8000-000000000001",
    changeSummary: null,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    meetingDetail: { defaultDurationMinutes: 75, modality: null, preparationNotes: null, authoringNotes: null },
    courseworkDetail: null,
    assessmentDetail: null,
    milestoneTemplates: [],
  };
}

describe("Activity version publish route", () => {
  beforeEach(() => {
    publishActivityVersionMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/activity-versions/av-1/publish", { method: "POST" }), {
      params: Promise.resolve({ id: "av-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 for another instructor's Activity version", async () => {
    const { DomainInvariantError } = await import("@/services/redesign");
    publishActivityVersionMock.mockRejectedValueOnce(new DomainInvariantError("Activity version not found"));

    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/activity-versions/av-1/publish", { method: "POST" }), {
      params: Promise.resolve({ id: "av-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("publishes an unpublished version", async () => {
    publishActivityVersionMock.mockResolvedValueOnce(versionRow("2026-07-15T00:00:00.000Z"));

    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/activity-versions/av-1/publish", { method: "POST" }), {
      params: Promise.resolve({ id: "av-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.version.publishedAt).toBe("2026-07-15T00:00:00.000Z");
  });

  it("is idempotent when called a second time on an already-published version", async () => {
    publishActivityVersionMock.mockResolvedValueOnce(versionRow("2026-07-15T00:00:00.000Z"));

    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/activity-versions/av-1/publish", { method: "POST" }), {
      params: Promise.resolve({ id: "av-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.version.publishedAt).toBe("2026-07-15T00:00:00.000Z");
  });
});
