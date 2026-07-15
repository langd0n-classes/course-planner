import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { applyTermActivityAdoptionMock } = vi.hoisted(() => ({
  applyTermActivityAdoptionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn() }));
vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  ConcurrencyConflictError: class ConcurrencyConflictError extends Error {},
  applyTermActivityAdoption: applyTermActivityAdoptionMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

describe("Term adoption apply route", () => {
  beforeEach(() => {
    authMock.mockReset();
    applyTermActivityAdoptionMock.mockReset();
  });

  it("returns 409 for concurrency conflicts", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "alice@example.edu", name: "Alice" });
    const { ConcurrencyConflictError } = await import("@/services/redesign");
    applyTermActivityAdoptionMock.mockRejectedValueOnce(new ConcurrencyConflictError("stale"));

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/adoption-apply", {
        method: "POST",
        body: JSON.stringify({
          learningModuleVersionSelections: [],
          crossCuttingSelections: [],
          previewToken: "preview-token",
          expectedCurrentActivityCount: 0,
        }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("returns applied term activities", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "alice@example.edu", name: "Alice" });
    applyTermActivityAdoptionMock.mockResolvedValueOnce({
      kind: "applied",
      termActivities: [{
        id: "ta-1",
        termId: "term-1",
        courseId: "course-1",
        activityId: "activity-1",
        plannedActivityVersionId: "av-1",
        activityTypeVersionId: "atv-1",
        adoptedLabel: "Lecture",
        termLearningModuleId: "tlm-1",
        ordinal: 0,
        lifecycleState: null,
        plannedRevisionId: "tar-1",
        deliveredRevisionId: null,
        archivedAt: null,
      }],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/adoption-apply", {
        method: "POST",
        body: JSON.stringify({
          learningModuleVersionSelections: [],
          crossCuttingSelections: [],
          previewToken: "preview-token",
          expectedCurrentActivityCount: 0,
        }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.termActivities[0].plannedRevisionId).toBe("tar-1");
  });
});
