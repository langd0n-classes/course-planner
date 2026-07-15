import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const prismaMock = {
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

function instructor() {
  return { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.edu", name: "Alice" };
}

describe("Activity Learning Module scope route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-versions/av-1/lm-scope"), {
      params: Promise.resolve({ id: "av-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("lists scopes ordered by learningModuleId", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityVersion: {
          findUnique: vi.fn(async () => ({
            id: "av-1",
            activity: { id: "activity-1", courseId: "course-1", course: { instructorId: instructor().id } },
          })),
        },
        activityVersionLearningModuleScope: {
          findMany: vi.fn(async () => [
            { id: "s-1", activityVersionId: "av-1", learningModuleId: "lm-1", emphasis: null, notes: null },
          ]),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-versions/av-1/lm-scope"), {
      params: Promise.resolve({ id: "av-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scopes: [{ id: "s-1", activityVersionId: "av-1", learningModuleId: "lm-1", emphasis: null, notes: null }],
    });
  });

  it("returns 404 for another Instructor's Activity version", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityVersion: {
          findUnique: vi.fn(async () => ({
            id: "av-1",
            activity: { id: "activity-1", courseId: "course-1", course: { instructorId: "someone-else" } },
          })),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-versions/av-1/lm-scope"), {
      params: Promise.resolve({ id: "av-1" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid replace payload", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activity-versions/av-1/lm-scope", {
        method: "PUT",
        body: JSON.stringify({ scopes: [{ learningModuleId: "not-a-uuid" }] }),
      }),
      { params: Promise.resolve({ id: "av-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("replaces the scope set and returns 200", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityVersion: {
          findUnique: vi.fn(async () => ({
            id: "av-1",
            activity: { id: "activity-1", courseId: "course-1", course: { instructorId: instructor().id } },
          })),
        },
        learningModule: {
          findUnique: vi.fn(async () => ({ courseId: "course-1" })),
        },
        activityVersionLearningModuleScope: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          createMany: vi.fn(async () => ({ count: 1 })),
          findMany: vi.fn(async () => [
            { id: "s-1", activityVersionId: "av-1", learningModuleId: "20000000-0000-4000-8000-000000000001", emphasis: "recap", notes: null },
          ]),
        },
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activity-versions/av-1/lm-scope", {
        method: "PUT",
        body: JSON.stringify({
          scopes: [{ learningModuleId: "20000000-0000-4000-8000-000000000001", emphasis: "recap" }],
        }),
      }),
      { params: Promise.resolve({ id: "av-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.scopes).toHaveLength(1);
    expect(body.scopes[0].emphasis).toBe("recap");
  });
});
