import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { previewTermActivityAdoptionMock } = vi.hoisted(() => ({
  previewTermActivityAdoptionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn() }));
vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  previewTermActivityAdoption: previewTermActivityAdoptionMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

describe("Term adoption preview route", () => {
  beforeEach(() => {
    authMock.mockReset();
    previewTermActivityAdoptionMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/adoption-preview", {
        method: "POST",
        body: JSON.stringify({ learningModuleVersionSelections: [], crossCuttingSelections: [] }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid payloads", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "alice@example.edu", name: "Alice" });
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/adoption-preview", {
        method: "POST",
        body: JSON.stringify({ learningModuleVersionSelections: [{}], crossCuttingSelections: [] }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns preview candidates for an owned term", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "alice@example.edu", name: "Alice" });
    previewTermActivityAdoptionMock.mockResolvedValueOnce({
      kind: "preview",
      previewToken: "preview-token",
      expectedCurrentActivityCount: 0,
      candidates: [{ activityId: "activity-1", activityVersionId: "av-1", adoptedLabel: "Lecture", ordinal: 0, termLearningModuleId: "tlm-1" }],
      impact: { issues: [], topicActionDuplicates: [], calendarConflicts: [] },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/adoption-preview", {
        method: "POST",
        body: JSON.stringify({ learningModuleVersionSelections: [], crossCuttingSelections: [] }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.previewToken).toBe("preview-token");
    expect(body.candidates).toHaveLength(1);
  });
});
