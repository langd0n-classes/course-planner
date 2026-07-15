import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { applyTermActivityRevisionMock } = vi.hoisted(() => ({
  applyTermActivityRevisionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn() }));
vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  ConcurrencyConflictError: class ConcurrencyConflictError extends Error {},
  applyTermActivityRevision: applyTermActivityRevisionMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

describe("Term Activity revision apply route", () => {
  beforeEach(() => {
    authMock.mockReset();
    applyTermActivityRevisionMock.mockReset();
  });

  it("returns 400 for invalid revision payloads", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "alice@example.edu", name: "Alice" });
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/term-activities/ta-1/revision-apply", {
        method: "POST",
        body: JSON.stringify({ title: "", detail: { behaviorFamily: "meeting" } }),
      }),
      { params: Promise.resolve({ id: "ta-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for foreign term activities", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "alice@example.edu", name: "Alice" });
    const { DomainInvariantError } = await import("@/services/redesign");
    applyTermActivityRevisionMock.mockRejectedValueOnce(new DomainInvariantError("Term Activity not found"));

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/term-activities/ta-1/revision-apply", {
        method: "POST",
        body: JSON.stringify({
          title: "Correction",
          previewToken: "preview-token",
          expectedCurrentRevisionId: null,
          advancePointer: "delivered",
          detail: { behaviorFamily: "coursework", lifecycleState: "submitted" },
        }),
      }),
      { params: Promise.resolve({ id: "ta-1" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns 200 with serialized revision payload", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "alice@example.edu", name: "Alice" });
    applyTermActivityRevisionMock.mockResolvedValueOnce({
      kind: "applied",
      termActivity: {
        id: "ta-1",
        termId: "term-1",
        courseId: "course-1",
        activityId: "activity-1",
        plannedActivityVersionId: "av-1",
        activityTypeVersionId: "atv-1",
        adoptedLabel: "Lecture",
        termLearningModuleId: null,
        ordinal: null,
        lifecycleState: "submitted",
        plannedRevisionId: "tar-1",
        deliveredRevisionId: "tar-2",
        archivedAt: null,
      },
      revision: {
        id: "tar-2",
        termActivityId: "ta-1",
        revision: 2,
        baseActivityVersionId: "av-1",
        title: "Correction",
        summary: null,
        changeReason: null,
        createdByInstructorId: "instructor-1",
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        meetingDetail: null,
        courseworkDetail: { lifecycleState: "submitted", deliveryNotes: null },
        assessmentDetail: null,
        topicActions: [],
        milestones: [],
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/term-activities/ta-1/revision-apply", {
        method: "POST",
        body: JSON.stringify({
          title: "Correction",
          previewToken: "preview-token",
          expectedCurrentRevisionId: null,
          advancePointer: "delivered",
          detail: { behaviorFamily: "coursework", lifecycleState: "submitted" },
        }),
      }),
      { params: Promise.resolve({ id: "ta-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.revision.detail.behaviorFamily).toBe("coursework");
    expect(body.termActivity.deliveredRevisionId).toBe("tar-2");
  });
});
