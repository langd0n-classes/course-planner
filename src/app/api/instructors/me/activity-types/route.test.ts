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

describe("instructor Activity Type vocabulary collection route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("lists the authenticated instructor's Activity Types", async () => {
    authMock.mockResolvedValue(instructor());
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityType: {
          findMany: vi.fn(async () => [
            {
              id: "at-1",
              instructorId: "10000000-0000-4000-8000-000000000001",
              behaviorFamily: "meeting",
              currentVersionId: "20000000-0000-4000-8000-000000000001",
              archivedAt: null,
            },
          ]),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activityTypes: [
        {
          id: "at-1",
          instructorId: "10000000-0000-4000-8000-000000000001",
          behaviorFamily: "meeting",
          currentVersionId: "20000000-0000-4000-8000-000000000001",
          archivedAt: null,
        },
      ],
    });
  });

  it("creates an Activity Type and its revision-1 version", async () => {
    authMock.mockResolvedValue(instructor());
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityType: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "at-1",
            currentVersionId: null,
            archivedAt: null,
            ...data,
          })),
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
        },
        activityTypeVersion: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "20000000-0000-4000-8000-000000000001",
            ...data,
          })),
        },
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/instructors/me/activity-types", {
        method: "POST",
        body: JSON.stringify({
          behaviorFamily: "meeting",
          createdByInstructorId: "10000000-0000-4000-8000-000000000001",
          version: { label: "Discussion" },
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      activityType: {
        id: "at-1",
        instructorId: "10000000-0000-4000-8000-000000000001",
        behaviorFamily: "meeting",
        currentVersionId: "20000000-0000-4000-8000-000000000001",
        archivedAt: null,
      },
      currentVersion: {
        id: "20000000-0000-4000-8000-000000000001",
        activityTypeId: "at-1",
        revision: 1,
        label: "Discussion",
        description: null,
        changeSummary: null,
        publishedAt: null,
      },
    });
  });

  it("returns 403 when creating for another instructor", async () => {
    authMock.mockResolvedValue(instructor());

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/instructors/me/activity-types", {
        method: "POST",
        body: JSON.stringify({
          behaviorFamily: "meeting",
          createdByInstructorId: "10000000-0000-4000-8000-000000000002",
          version: { label: "Discussion" },
        }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
