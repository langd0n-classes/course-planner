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

describe("Course Activity Type enablement route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 404 for a Course owned by another instructor", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ course: { findUnique: vi.fn(async () => null) } }),
    );

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/courses/course-1/activity-types"), {
      params: Promise.resolve({ id: "course-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("rejects duplicate activityTypeVersionIds via the frozen schema", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/courses/course-1/activity-types", {
        method: "PUT",
        body: JSON.stringify({ activityTypeVersionIds: ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001"] }),
      }),
      { params: Promise.resolve({ id: "course-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("rejects enabling a version from another instructor's vocabulary", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        course: { findUnique: vi.fn(async () => ({ id: "course-1", instructorId: "10000000-0000-4000-8000-000000000001" })) },
        activityTypeVersion: {
          findUnique: vi.fn(async () => ({ id: "20000000-0000-4000-8000-000000000001", activityType: { instructorId: "10000000-0000-4000-8000-000000000002" } })),
        },
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/courses/course-1/activity-types", {
        method: "PUT",
        body: JSON.stringify({ activityTypeVersionIds: ["20000000-0000-4000-8000-000000000001"] }),
      }),
      { params: Promise.resolve({ id: "course-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("replaces course-enabled versions transactionally and returns the resulting rows", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        course: { findUnique: vi.fn(async () => ({ id: "course-1", instructorId: "10000000-0000-4000-8000-000000000001" })) },
        activityTypeVersion: {
          findUnique: vi.fn(async () => ({ id: "20000000-0000-4000-8000-000000000001", activityType: { instructorId: "10000000-0000-4000-8000-000000000001" } })),
        },
        courseActivityTypeVersion: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          createMany: vi.fn(async () => ({ count: 1 })),
          findMany: vi.fn(async () => [
            { courseId: "course-1", activityTypeVersionId: "20000000-0000-4000-8000-000000000001", enabledAt: new Date("2026-07-14T00:00:00.000Z") },
          ]),
        },
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/courses/course-1/activity-types", {
        method: "PUT",
        body: JSON.stringify({ activityTypeVersionIds: ["20000000-0000-4000-8000-000000000001"] }),
      }),
      { params: Promise.resolve({ id: "course-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activityTypeVersions: [
        { courseId: "course-1", activityTypeVersionId: "20000000-0000-4000-8000-000000000001", enabledAt: "2026-07-14T00:00:00.000Z" },
      ],
    });
  });
});
