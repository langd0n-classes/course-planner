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

const topicId = "20000000-0000-4000-8000-000000000001";

describe("Activity Topic scope route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activities/activity-1/topic-scope"), {
      params: Promise.resolve({ id: "activity-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid replace payload", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activities/activity-1/topic-scope", {
        method: "PUT",
        body: JSON.stringify({ scopes: [{ topicId: "not-a-uuid" }] }),
      }),
      { params: Promise.resolve({ id: "activity-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for another Instructor's Activity", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activity: {
          findUnique: vi.fn(async () => ({ id: "activity-1", courseId: "course-1", course: { instructorId: "someone-else" } })),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activities/activity-1/topic-scope"), {
      params: Promise.resolve({ id: "activity-1" }),
    });
    expect(response.status).toBe(404);
  });

  it("replaces the scope set and returns 200", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activity: {
          findUnique: vi.fn(async () => ({
            id: "activity-1",
            courseId: "course-1",
            course: { instructorId: instructor().id },
          })),
        },
        topic: {
          findUnique: vi.fn(async () => ({ courseId: "course-1" })),
        },
        activityTopicScope: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          createMany: vi.fn(async () => ({ count: 1 })),
          findMany: vi.fn(async () => [
            { id: "sc-1", activityId: "activity-1", topicId, notes: null, provenance: null },
          ]),
        },
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activities/activity-1/topic-scope", {
        method: "PUT",
        body: JSON.stringify({ scopes: [{ topicId }] }),
      }),
      { params: Promise.resolve({ id: "activity-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scopes: [{ id: "sc-1", activityId: "activity-1", topicId, notes: null, provenance: null }],
    });
  });

  it("returns 404 for a cross-Course Topic reference", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activity: {
          findUnique: vi.fn(async () => ({
            id: "activity-1",
            courseId: "course-1",
            course: { instructorId: instructor().id },
          })),
        },
        topic: {
          findUnique: vi.fn(async () => null),
        },
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activities/activity-1/topic-scope", {
        method: "PUT",
        body: JSON.stringify({ scopes: [{ topicId }] }),
      }),
      { params: Promise.resolve({ id: "activity-1" }) },
    );
    expect(response.status).toBe(404);
  });
});
