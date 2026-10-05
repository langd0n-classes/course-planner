import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const { publishMock } = vi.hoisted(() => ({ publishMock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn() }));
vi.mock("@/services/redesign", () => ({
  ConcurrencyConflictError: class ConcurrencyConflictError extends Error {},
  DomainInvariantError: class DomainInvariantError extends Error {},
  publishLearningModuleVersion: publishMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);
const request = new NextRequest("http://localhost/api/learning-module-versions/lmv-1/publish", { method: "POST" });
const context = { params: Promise.resolve({ id: "lmv-1" }) };

describe("Learning Module version publish route", () => {
  beforeEach(() => {
    authMock.mockReset();
    publishMock.mockReset();
    authMock.mockResolvedValue({ id: "instructor-1", email: "instructor@example.edu", name: "Instructor" });
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    expect((await POST(request, context)).status).toBe(401);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("publishes the owned draft and returns its memberships", async () => {
    publishMock.mockResolvedValue({
      id: "lmv-1", learningModuleId: "lm-1", revision: 2, title: "Module",
      description: null, studentDescription: null, learningObjectives: [], notes: null,
      defaultSequence: null, changeSummary: null, publishedAt: new Date("2026-10-04T00:00:00Z"),
      topics: [{ topicVersionId: "tv-1", sequence: 0 }], activities: [],
    });
    const { POST } = await import("./route");
    const response = await POST(request, context);
    expect(response.status).toBe(200);
    expect(publishMock).toHaveBeenCalledWith(expect.anything(), "instructor-1", "lmv-1");
    expect((await response.json()).version).toMatchObject({
      publishedAt: "2026-10-04T00:00:00.000Z", topics: [{ topicVersionId: "tv-1", sequence: 0 }],
    });
  });

  it("rejects an unowned version and a stale draft", async () => {
    const { POST } = await import("./route");
    const { DomainInvariantError, ConcurrencyConflictError } = await import("@/services/redesign");
    publishMock.mockRejectedValueOnce(new DomainInvariantError("Learning Module version not found"));
    expect((await POST(request, context)).status).toBe(404);
    publishMock.mockRejectedValueOnce(new ConcurrencyConflictError());
    expect((await POST(request, context)).status).toBe(409);
  });
});
